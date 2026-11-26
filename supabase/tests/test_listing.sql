-- Listing tests (migration 0008): who can list, fee/amenity rules, admin review, photo storage rules,
-- checklist keys and rate limits. Runs in one transaction and rolls back. Success prints
-- "all listing tests passed"; any failed assertion aborts with its message.

begin;

create function pg_temp.mk_user(p_role text, p_name text, p_verified boolean default true)
returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'listing-test-' || u || '@example.invalid',
          jsonb_build_object('is_adult', true, 'role', case when p_role in ('admin', 'scout') then 'student' else p_role end,
                             'full_name', p_name, 'accepted_terms', true),
          'authenticated', 'authenticated');
  if p_role in ('admin', 'scout') then update public.profiles set role = p_role::public.user_role where id = u; end if;
  if p_verified then update public.profiles set identity_verified_at = now() where id = u; end if;
  return u;
end $$;

create function pg_temp.email(p_user uuid) returns text language sql as $$ select email from auth.users where id = p_user $$;

-- Act as a signed-in user (or anon with null), through RLS, like PostgREST does.
create function pg_temp.act(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', coalesce(jsonb_build_object('sub', p_user)::text, '{}'), true);
  if p_user is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create function pg_temp.as_admin_db() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{}', true);
end $$;

-- Expect `sql` to fail with an error whose message matches `pattern`.
create function pg_temp.fails(p_sql text, p_pattern text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm !~* p_pattern then
      raise exception '% failed with the wrong error: %', p_label, sqlerrm;
    end if;
    return;
  end;
  raise exception '% should have failed (expected /%/)', p_label, p_pattern;
end $$;

-- A create_lodge call with sensible defaults; override the parts a test cares about.
create function pg_temp.list(p_fee bigint default 0, p_partner text default null, p_rent_to_agent boolean default false,
                             p_commission smallint default 5, p_commitment smallint default 0,
                             p_amenities text[] default '{tiled,own_bathroom}', p_rent bigint default 25000000)
returns uuid language sql as $$
  select public.create_lodge('Self-contain near Main Gate', 'Quiet fenced compound', 'Eziobodo', '12 Orchard Close',
                             'self_contain', p_amenities, 650, 'main_gate', p_rent, p_fee, p_commitment, p_commission,
                             p_partner, p_rent_to_agent, 'test')
$$;

do $tests$
declare
  landlord   uuid := pg_temp.mk_user('landlord', 'Chinedu Obi');
  unverified uuid := pg_temp.mk_user('landlord', 'New Landlord', false);
  agent      uuid := pg_temp.mk_user('agent', 'Ngozi Eze');
  agent_unv  uuid := pg_temp.mk_user('agent', 'Unverified Agent', false);
  stranger   uuid := pg_temp.mk_user('landlord', 'Other Landlord');
  student    uuid := pg_temp.mk_user('student', 'Ada Student');
  admin      uuid := pg_temp.mk_user('admin', 'Admin');
  scout      uuid := pg_temp.mk_user('scout', 'Amaka Scout');
  spammer    uuid := pg_temp.mk_user('landlord', 'Spam Landlord');
  -- Emails looked up up front: signed-in roles can't read auth.users.
  e_landlord text := pg_temp.email(landlord);
  e_agent    text := pg_temp.email(agent);
  e_agent_unv text := pg_temp.email(agent_unv);
  e_student  text := pg_temp.email(student);
  l_solo     uuid;
  l_agent    uuid;
  l_by_agent uuid;
  l_bad_agent uuid;
  l_stranger uuid;
  r          public.lodges;
  n          integer;
  p1         text;
  p2         text;
  ph         uuid;
  removed    text;
begin
  -- ── who can list
  perform pg_temp.act(student);
  perform pg_temp.fails('select pg_temp.list()', 'only landlords and agents', 'student listing');
  perform pg_temp.act(unverified);
  perform pg_temp.fails('select pg_temp.list()', 'verify your identity', 'unverified landlord listing');
  perform pg_temp.act(null);
  perform pg_temp.fails('select pg_temp.list()', 'permission denied', 'anon listing');

  perform pg_temp.act(landlord);
  perform pg_temp.fails($$insert into public.lodges (owner_id, title, area, address, rent_kobo)
                          values (auth.uid(), 'Sneaky', 'Eziobodo', 'x', 10000000)$$,
                        'row-level security', 'direct insert bypassing create_lodge');

  -- ── landlord lists alone
  l_solo := pg_temp.list();
  perform pg_temp.as_admin_db();
  select * into r from public.lodges where id = l_solo;
  assert r.status = 'pending_review' and r.owner_id = landlord and r.agent_id is null and r.submitted_at is not null,
    'landlord listing should be pending review, owned by the landlord';
  assert r.amenities = '{tiled,own_bathroom}', 'amenities stored';

  -- ── fee and catalogue rules
  perform pg_temp.act(landlord);
  perform pg_temp.fails('select pg_temp.list(p_fee => 100000)', 'agent_fee_needs_agent', 'agent fee without an agent');
  perform pg_temp.fails(format('select pg_temp.list(p_fee => 1250001, p_partner => %L)', e_agent),
                        'agent_fee_cap', 'agent fee over 5%');
  perform pg_temp.fails('select pg_temp.list(p_commission => 11::smallint)', 'landlord_commission_pct_range', 'commission over 10%');
  perform pg_temp.fails('select pg_temp.list(p_commitment => 5::smallint)', 'commitment_fee_pct_range', 'commitment fee of 5%');
  perform pg_temp.fails($$select pg_temp.list(p_amenities => '{tiled,jacuzzi}')$$, 'lodges_amenities_known', 'unknown amenity');
  perform pg_temp.fails('select pg_temp.list(p_rent_to_agent => true)', 'landlord with an agent', 'rent to agent without an agent');
  perform pg_temp.fails(format('select pg_temp.list(p_partner => %L)', e_student), 'no agent account', 'partner who is not an agent');

  -- ── landlord with agent, fees, commitment and rent paid to the agent
  l_agent := pg_temp.list(p_fee => 1250000, p_partner => upper(e_agent), p_rent_to_agent => true,
                          p_commission => 7::smallint, p_commitment => 15::smallint);
  perform pg_temp.as_admin_db();
  select * into r from public.lodges where id = l_agent;
  assert r.agent_id = agent and r.agent_fee_kobo = 1250000 and r.landlord_commission_pct = 7 and r.commitment_fee_pct = 15,
    'landlord-with-agent listing stores agent and fees';
  assert exists (select 1 from public.payee_mandates where lodge_id = l_agent and agent_id = agent and revoked_at is null),
    'rent-to-agent listing signs a payee mandate';

  -- ── agent lists for a landlord
  perform pg_temp.act(agent);
  perform pg_temp.fails('select pg_temp.list()', 'must name the landlord', 'agent listing without a landlord');
  perform pg_temp.fails(format('select pg_temp.list(p_partner => %L, p_rent_to_agent => true)', e_landlord),
                        'landlord with an agent', 'agent directing rent to themselves');
  l_by_agent := pg_temp.list(p_fee => 1000000, p_partner => e_landlord);
  perform pg_temp.as_admin_db();
  select * into r from public.lodges where id = l_by_agent;
  assert r.owner_id = landlord and r.agent_id = agent, 'agent listing: landlord owns, agent is the agent';

  -- ── admin review
  perform pg_temp.act(null);
  assert not exists (select 1 from public.lodges where id = l_solo), 'pending lodge must not be public';
  perform pg_temp.act(landlord);
  perform pg_temp.fails(format('select public.review_lodge(%L, true)', l_solo), 'admins only', 'landlord approving own lodge');

  perform pg_temp.act(admin);
  perform public.review_lodge(l_solo, true);
  perform pg_temp.fails(format('select public.review_lodge(%L, false)', l_agent), 'give a reason', 'reject without reason');
  perform public.review_lodge(l_agent, false, 'Photos missing');
  perform pg_temp.act(null);
  assert exists (select 1 from public.lodges where id = l_solo and status = 'verified'), 'approved lodge is public';
  perform pg_temp.as_admin_db();
  select * into r from public.lodges where id = l_agent;
  assert r.status = 'draft' and r.review_note = 'Photos missing', 'rejected lodge returns to draft with the reason';

  perform pg_temp.act(agent);  -- the agent can resubmit too
  perform public.submit_lodge(l_agent);
  perform pg_temp.fails(format('select public.submit_lodge(%L)', l_agent), 'not a draft', 'submitting twice');
  perform pg_temp.as_admin_db();
  select * into r from public.lodges where id = l_agent;
  assert r.status = 'pending_review' and r.review_note is null, 'resubmitted lodge is pending again, reason cleared';

  perform pg_temp.act(landlord);
  l_bad_agent := pg_temp.list(p_partner => e_agent_unv);
  perform pg_temp.act(admin);
  perform pg_temp.fails(format('select public.review_lodge(%L, true)', l_bad_agent), 'agent is not verified',
                        'approving with an unverified agent');

  -- ── photos: storage rules
  perform pg_temp.act(stranger);
  l_stranger := pg_temp.list();
  p1 := l_solo || '/' || gen_random_uuid() || '.jpg';
  p2 := l_solo || '/' || gen_random_uuid() || '.webp';

  perform pg_temp.act(landlord);
  insert into storage.objects (bucket_id, name, owner) values ('lodge-photos', p1, landlord);
  perform pg_temp.fails(format($$insert into storage.objects (bucket_id, name) values ('lodge-photos', %L)$$,
                               l_stranger || '/' || gen_random_uuid() || '.jpg'),
                        'row-level security', 'uploading into someone else''s lodge');
  perform pg_temp.fails(format($$insert into storage.objects (bucket_id, name) values ('lodge-photos', %L)$$,
                               l_solo || '/evil.exe'),
                        'row-level security', 'uploading a badly named file');

  -- ── photos: registering
  perform pg_temp.fails(format('select public.add_lodge_photo(%L, %L)', l_solo, p2), 'not been uploaded', 'registering a missing file');
  perform pg_temp.fails(format('select public.add_lodge_photo(%L, %L)', l_agent, p1), 'does not belong', 'registering under another lodge');
  ph := public.add_lodge_photo(l_solo, p1);
  perform pg_temp.as_admin_db();
  assert (select position from public.lodge_photos where id = ph) = 0, 'first photo has position 0';
  assert (select status from public.lodges where id = l_solo) = 'pending_review',
    'adding a photo to a live lodge sends it back to review';

  perform pg_temp.act(stranger);
  perform pg_temp.fails(format('select public.add_lodge_photo(%L, %L)', l_solo, p1), 'lodge not found', 'stranger registering a photo');
  perform pg_temp.fails(format('select public.remove_lodge_photo(%L)', ph), 'photo not found', 'stranger removing a photo');

  -- visibility follows the lodge: hidden while pending, visible once approved
  perform pg_temp.act(null);
  assert not exists (select 1 from storage.objects where name = p1), 'pending lodge photo hidden from anon';
  perform pg_temp.act(admin);
  perform public.review_lodge(l_solo, true);
  perform pg_temp.act(null);
  assert exists (select 1 from storage.objects where name = p1), 'live lodge photo visible to anon';

  -- a scout with an assigned inspection may add photos without sending the lodge back to review
  perform pg_temp.as_admin_db();
  insert into public.inspections (lodge_id, scout_id, status) values (l_solo, scout, 'assigned');
  perform pg_temp.act(scout);
  insert into storage.objects (bucket_id, name, owner) values ('lodge-photos', p2, scout);
  perform public.add_lodge_photo(l_solo, p2);
  perform pg_temp.as_admin_db();
  assert (select status from public.lodges where id = l_solo) = 'verified', 'scout photo keeps the lodge live';

  perform pg_temp.act(landlord);
  removed := public.remove_lodge_photo(ph);
  assert removed = p1, 'remove returns the storage path to delete';
  perform pg_temp.as_admin_db();
  assert (select position from public.lodge_photos where storage_path = p2) = 0, 'positions close the gap';

  -- at most 10 photos
  for n in 1..9 loop
    p1 := l_by_agent || '/' || gen_random_uuid() || '.png';
    insert into storage.objects (bucket_id, name) values ('lodge-photos', p1);
    perform pg_temp.act(agent);
    perform public.add_lodge_photo(l_by_agent, p1);
    perform pg_temp.as_admin_db();
  end loop;
  p1 := l_by_agent || '/' || gen_random_uuid() || '.png';
  insert into storage.objects (bucket_id, name) values ('lodge-photos', p1);
  perform pg_temp.act(agent);
  perform public.add_lodge_photo(l_by_agent, p1);  -- 10th
  p1 := l_by_agent || '/' || gen_random_uuid() || '.png';
  perform pg_temp.as_admin_db();
  insert into storage.objects (bucket_id, name) values ('lodge-photos', p1);
  perform pg_temp.act(agent);
  perform pg_temp.fails(format('select public.add_lodge_photo(%L, %L)', l_by_agent, p1), 'at most 10', 'an 11th photo');

  -- ── checklist keys
  perform pg_temp.as_admin_db();
  insert into public.inspections (lodge_id, scout_id, status, checklist)
  values (l_by_agent, scout, 'approved', '{"generator_away_from_room": true, "room_matches_size": false, "water_running": true}');
  perform pg_temp.fails($$insert into public.inspections (lodge_id, scout_id, checklist)
                          values ('$$ || l_by_agent || $$', '$$ || scout || $$', '{"has_wifi": true}')$$,
                        'inspections_checklist_known', 'unknown checklist key');
  perform pg_temp.fails($$insert into public.inspections (lodge_id, scout_id, checklist)
                          values ('$$ || l_by_agent || $$', '$$ || scout || $$', '{"water_running": "yes"}')$$,
                        'inspections_checklist_known', 'non-boolean checklist value');

  -- ── rate limit: 10 listings an hour
  perform pg_temp.act(spammer);
  for n in 1..10 loop perform pg_temp.list(); end loop;
  perform pg_temp.fails('select pg_temp.list()', 'rate limit', 'an 11th listing in an hour');

  perform pg_temp.as_admin_db();
  raise notice 'all listing tests passed';
end $tests$;

rollback;
