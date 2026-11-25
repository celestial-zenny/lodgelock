-- 0008: landlords and agents list lodges; admins approve them; lodge photos live in Supabase Storage;
-- new amenities and inspection checklist items.
--
-- Rules
-- * Only ID-verified landlords and agents can list (create_lodge). A new lodge goes straight to admin review
--   (pending_review). An admin approval makes it live (verified). A scout inspection is a BONUS badge, never a gate.
-- * A landlord lists their own lodge, optionally naming their agent by email. An agent must name the landlord
--   (by email); the landlord stays the owner and payee.
-- * Agent fee (student-paid, 5% cap), landlord commission (0-10%) and commitment fee (0 or 10-20%) are set at
--   listing time; the existing table constraints enforce the caps. A landlord with an agent can direct rent to
--   the agent with a payee mandate (sign_payee_mandate, 0007) in the same call.
-- * Photos: private bucket `lodge-photos`, path `<lodge id>/<uuid>.<jpg|png|webp>`. Upload is allowed to the
--   lodge's owner/agent and to a scout with an assigned inspection; reads follow the lodge's visibility.
--   Adding or removing a photo on a live lodge by its owner/agent sends it back to review, like any edit.

-- ─────────────────────────────────────────────────────────────── catalogue
-- Keep in sync with src/lib/listing.ts (AMENITIES, CHECKLIST_ITEMS).
create function private.allowed_amenities() returns text[] language sql immutable set search_path = ''
as $$ select array['prepaid_meter', 'borehole', 'fenced', 'security', 'tiled', 'pop_ceiling', 'kitchenette',
                   'kitchen', 'shared_kitchen', 'own_bathroom', 'shared_bathroom', 'wardrobe', 'solar_backup',
                   'parking'] $$;

create function private.allowed_checklist_keys() returns text[] language sql immutable set search_path = ''
as $$ select array['matches_listing', 'water_running', 'power_working', 'doors_lock', 'no_leaks', 'toilet_working',
                   'generator_away_from_room', 'room_matches_size'] $$;

-- A checklist is a JSON object of known keys to booleans.
create function private.checklist_ok(c jsonb) returns boolean language sql immutable set search_path = ''
as $$ select jsonb_typeof(c) = 'object'
         and not exists (select 1 from jsonb_each(c) e
                          where e.key <> all (private.allowed_checklist_keys()) or jsonb_typeof(e.value) <> 'boolean') $$;

alter table public.lodges
  add constraint lodges_amenities_known check (amenities <@ private.allowed_amenities() and cardinality(amenities) <= 20),
  add column submitted_at timestamptz,
  add column review_note  text check (review_note is null or char_length(review_note) <= 500);

alter table public.inspections
  add constraint inspections_checklist_known check (private.checklist_ok(checklist));

-- ─────────────────────────────────────────────────────────────── listing
-- All creation goes through create_lodge (verification check + rate limit). Owners still edit their own lodges
-- directly under lodges_edit; lodges_guard sends an edited live lodge back to review.
drop policy lodges_create on public.lodges;

create function public.create_lodge(
  p_title text,
  p_description text,
  p_area text,
  p_address text,
  p_room_type public.room_type,
  p_amenities text[],
  p_distance_to_gate_m integer,
  p_nearest_gate text,
  p_rent_kobo bigint,
  p_agent_fee_kobo bigint,
  p_commitment_fee_pct smallint,
  p_landlord_commission_pct smallint,
  p_partner_email text default null,      -- landlord's email if an agent lists; agent's email if a landlord lists
  p_rent_to_agent boolean default false,  -- landlord only: pay rent to the agent (signs a payee mandate)
  p_policy_version text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid          uuid := auth.uid();
  me           public.profiles;
  partner_role public.user_role;
  partner      uuid;
  v_owner      uuid;
  v_agent      uuid;
  l_id         uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform private.hit_rate_limit('create_lodge:' || uid, 10, 3600);

  select * into me from public.profiles where id = uid;
  if me.id is null or me.role not in ('landlord', 'agent') then
    raise exception 'only landlords and agents can list lodges';
  end if;
  if me.identity_verified_at is null then raise exception 'verify your identity before listing'; end if;

  partner_role := case when me.role = 'agent' then 'landlord' else 'agent' end;
  if nullif(trim(p_partner_email), '') is not null then
    select p.id into partner
      from auth.users u join public.profiles p on p.id = u.id
     where lower(u.email) = lower(trim(p_partner_email)) and p.role = partner_role;
    if partner is null then raise exception 'no % account with that email', partner_role; end if;
  end if;

  if me.role = 'agent' then
    if partner is null then raise exception 'agents must name the landlord'; end if;
    v_owner := partner;
    v_agent := uid;
  else
    v_owner := uid;
    v_agent := partner;
  end if;

  if coalesce(p_rent_to_agent, false) and (me.role <> 'landlord' or v_agent is null) then
    raise exception 'only a landlord with an agent can pay rent to the agent';
  end if;

  -- Runs as the function owner, so lodges_guard keeps the status we set; the table constraints still enforce
  -- the fee caps, amenity list and agent-fee-needs-agent rule.
  insert into public.lodges (owner_id, agent_id, title, description, area, address, room_type, amenities,
                             distance_to_gate_m, nearest_gate, rent_kobo, agent_fee_kobo, commitment_fee_pct,
                             landlord_commission_pct, status, submitted_at)
  values (v_owner, v_agent, trim(p_title), coalesce(trim(p_description), ''), trim(p_area), trim(p_address),
          p_room_type, coalesce(p_amenities, '{}'), p_distance_to_gate_m, nullif(p_nearest_gate, ''),
          p_rent_kobo, coalesce(p_agent_fee_kobo, 0), coalesce(p_commitment_fee_pct, 0),
          coalesce(p_landlord_commission_pct, 5), 'pending_review', now())
  returning id into l_id;

  if coalesce(p_rent_to_agent, false) then
    perform public.sign_payee_mandate(l_id, v_agent, p_policy_version);
  end if;
  return l_id;
end $$;

-- Owner or agent sends a draft (new, or rejected and fixed) back to admin review.
create function public.submit_lodge(p_lodge uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  update public.lodges set status = 'pending_review', submitted_at = now(), review_note = null
   where id = p_lodge and (owner_id = uid or agent_id = uid) and status = 'draft';
  if not found then raise exception 'lodge not found or not a draft'; end if;
end $$;

-- Admin decision. Approving needs a verified landlord (and agent, if any); rejecting needs a reason the lister sees.
create function public.review_lodge(p_lodge uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare l public.lodges;
begin
  if not private.is_admin() then raise exception 'admins only'; end if;
  select * into l from public.lodges where id = p_lodge for update;
  if l.id is null or l.status <> 'pending_review' then raise exception 'lodge is not waiting for review'; end if;

  if p_approve then
    if not exists (select 1 from public.profiles where id = l.owner_id and identity_verified_at is not null) then
      raise exception 'landlord is not verified';
    end if;
    if l.agent_id is not null
       and not exists (select 1 from public.profiles where id = l.agent_id and identity_verified_at is not null) then
      raise exception 'agent is not verified';
    end if;
    update public.lodges set status = 'verified', review_note = nullif(trim(p_note), '') where id = p_lodge;
  else
    if nullif(trim(p_note), '') is null then raise exception 'give a reason when rejecting'; end if;
    update public.lodges set status = 'draft', review_note = trim(p_note) where id = p_lodge;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────── photos
create function private.can_manage_lodge_photos(p_lodge_text text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lodges l
     where l.id::text = p_lodge_text
       and (l.owner_id = auth.uid() or l.agent_id = auth.uid()
            or exists (select 1 from public.inspections i
                        where i.lodge_id = l.id and i.scout_id = auth.uid() and i.status = 'assigned')))
$$;

create function private.can_view_lodge_photos(p_lodge_text text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lodges l
     where l.id::text = p_lodge_text
       and (l.status = 'verified' or l.owner_id = auth.uid() or l.agent_id = auth.uid()
            or l.caretaker_id = auth.uid() or private.is_admin()
            or exists (select 1 from public.inspections i where i.lodge_id = l.id and i.scout_id = auth.uid())))
$$;
revoke execute on function private.can_manage_lodge_photos(text), private.can_view_lodge_photos(text) from public;
grant execute on function private.can_manage_lodge_photos(text), private.can_view_lodge_photos(text)
  to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lodge-photos', 'lodge-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy lodge_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'lodge-photos'
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
              and private.can_manage_lodge_photos((storage.foldername(name))[1]));
create policy lodge_photos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'lodge-photos' and private.can_view_lodge_photos((storage.foldername(name))[1]));
create policy lodge_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lodge-photos' and private.can_manage_lodge_photos((storage.foldername(name))[1]));
-- No update policy: photos are replaced by delete + upload, never overwritten.

alter table public.lodge_photos
  add column position smallint not null default 0,
  add constraint lodge_photos_path_unique unique (storage_path),
  add constraint lodge_photos_path_shape
    check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
create index on public.lodge_photos (lodge_id, position);

-- Writes go through these two functions only (they check the object really exists and keep the review rule).
drop policy photos_upload on public.lodge_photos;

create function public.add_lodge_photo(p_lodge uuid, p_path text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  l     public.lodges;
  n     integer;
  ph_id uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform private.hit_rate_limit('add_lodge_photo:' || uid, 60, 3600);
  select * into l from public.lodges where id = p_lodge for update;
  if l.id is null or not private.can_manage_lodge_photos(p_lodge::text) then raise exception 'lodge not found'; end if;
  if split_part(p_path, '/', 1) <> p_lodge::text then raise exception 'photo path does not belong to this lodge'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'lodge-photos' and name = p_path) then
    raise exception 'photo has not been uploaded';
  end if;
  select count(*) into n from public.lodge_photos where lodge_id = p_lodge;
  if n >= 10 then raise exception 'a lodge can have at most 10 photos'; end if;

  insert into public.lodge_photos (lodge_id, storage_path, uploaded_by, position)
  values (p_lodge, p_path, uid, n) returning id into ph_id;

  if l.status = 'verified' and coalesce(uid = l.owner_id or uid = l.agent_id, false) then
    update public.lodges set status = 'pending_review', submitted_at = now() where id = p_lodge;
  end if;
  return ph_id;
end $$;

-- Returns the storage path so the server can delete the file after the row is gone.
create function public.remove_lodge_photo(p_photo uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ph  public.lodge_photos;
  l   public.lodges;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into ph from public.lodge_photos where id = p_photo;
  if ph.id is null then raise exception 'photo not found'; end if;
  select * into l from public.lodges where id = ph.lodge_id for update;
  -- Null-safe: a lodge with no agent has agent_id null, and `uid in (owner, null)` would be null, not false.
  if not coalesce(uid = l.owner_id or uid = l.agent_id or ph.uploaded_by = uid, false) then
    raise exception 'photo not found';
  end if;

  delete from public.lodge_photos where id = p_photo;
  update public.lodge_photos set position = position - 1 where lodge_id = l.id and position > ph.position;
  if l.status = 'verified' and coalesce(uid = l.owner_id or uid = l.agent_id, false) then
    update public.lodges set status = 'pending_review', submitted_at = now() where id = l.id;
  end if;
  return ph.storage_path;
end $$;

revoke execute on function
  public.create_lodge(text, text, text, text, public.room_type, text[], integer, text, bigint, bigint, smallint,
                      smallint, text, boolean, text),
  public.submit_lodge(uuid), public.review_lodge(uuid, boolean, text),
  public.add_lodge_photo(uuid, text), public.remove_lodge_photo(uuid)
  from public, anon;
grant execute on function
  public.create_lodge(text, text, text, text, public.room_type, text[], integer, text, bigint, bigint, smallint,
                      smallint, text, boolean, text),
  public.submit_lodge(uuid), public.review_lodge(uuid, boolean, text),
  public.add_lodge_photo(uuid, text), public.remove_lodge_photo(uuid)
  to authenticated;
