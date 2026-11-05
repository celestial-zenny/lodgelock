-- Money-path tests for the booking economics (migrations 0005-0007).
-- Run against a database with all migrations applied. Everything happens inside one transaction and is rolled back:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/money_paths.sql
-- Any failed assertion aborts with its message. Success prints "all money path tests passed".
--
-- Invariants checked after every scenario (pg_temp.check_books):
--   * every ledger txn balances (debits = credits)
--   * every payout instruction has exactly one matching ledger credit in the same txn, and vice versa
--   * escrow taken = instructions issued + amount still held
--   * a released / cancelled booking holds nothing; a held booking holds exactly rent - commitment + agent fee
--   * no caretaker ever appears as a payee

begin;

create function pg_temp.mk_user(p_role text, p_name text, p_verified boolean default true)
returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'money-test-' || u || '@example.invalid',
          jsonb_build_object('is_adult', true, 'role', case when p_role in ('admin', 'scout') then 'student' else p_role end,
                             'full_name', p_name, 'accepted_terms', true),
          'authenticated', 'authenticated');
  if p_role in ('admin', 'scout') then update public.profiles set role = p_role::public.user_role where id = u; end if;
  if p_verified then update public.profiles set identity_verified_at = now() where id = u; end if;
  return u;
end $$;

create function pg_temp.mk_lodge(p_owner uuid, p_agent uuid, p_rent bigint, p_fee bigint,
                                 p_commitment_pct int default 0, p_commission_pct int default 5, p_caretaker uuid default null)
returns uuid language plpgsql as $$
declare l uuid;
begin
  insert into public.lodges (owner_id, agent_id, title, area, address, rent_kobo, agent_fee_kobo, status,
                             commitment_fee_pct, landlord_commission_pct, caretaker_id)
  values (p_owner, p_agent, 'Money test lodge', 'Eziobodo', 'Test address', p_rent, p_fee, 'verified',
          p_commitment_pct, p_commission_pct, p_caretaker)
  returning id into l;
  return l;
end $$;

-- Direct insert (as the table owner) so tests can use past move-in dates; bookings_guard still sets all money.
create function pg_temp.mk_booking(p_student uuid, p_lodge uuid, p_move_in date default current_date + 14)
returns uuid language plpgsql as $$
declare b uuid;
begin
  insert into public.bookings (student_id, lodge_id, rent_kobo, agent_fee_kobo, move_in_date)
  values (p_student, p_lodge, 0, 0, p_move_in) returning id into b;
  return b;
end $$;

create function pg_temp.pay(p_booking uuid) returns text language plpgsql as $$
declare ref text := 'LL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)); amt bigint;
begin
  select rent_kobo + agent_fee_kobo into amt from public.bookings where id = p_booking;
  insert into public.payment_attempts (booking_id, txn_ref, amount_kobo) values (p_booking, ref, amt);
  return public.record_payment(ref, '00', amt, 'PROV-' || ref);
end $$;

create function pg_temp.instr(p_booking uuid, p_payee uuid, p_kind text) returns bigint language sql as $$
  select coalesce(sum(amount_kobo), 0)::bigint from public.payout_instructions
   where booking_id = p_booking and payee_id = p_payee and kind = p_kind
$$;

create function pg_temp.instr_status(p_booking uuid, p_payee uuid) returns text language sql as $$
  select string_agg(distinct status, ',') from public.payout_instructions where booking_id = p_booking and payee_id = p_payee
$$;

create function pg_temp.held(p_booking uuid) returns bigint language sql as $$
  select coalesce(sum(case direction when 'credit' then amount_kobo else -amount_kobo end), 0)::bigint
    from public.ledger_entries where booking_id = p_booking and account = 'held:booking:' || p_booking
$$;

create function pg_temp.status(p_booking uuid) returns text language sql as $$
  select status::text from public.bookings where id = p_booking
$$;

create function pg_temp.check_books() returns void language plpgsql as $$
declare r record;
begin
  for r in select txn_id, sum(case direction when 'debit' then amount_kobo else -amount_kobo end) net
             from public.ledger_entries group by txn_id having sum(case direction when 'debit' then amount_kobo else -amount_kobo end) <> 0
  loop
    raise exception 'ledger txn % does not balance (net %)', r.txn_id, r.net;
  end loop;

  for r in
    select b.id, b.status,
           coalesce((select sum(amount_kobo) from public.ledger_entries e where e.booking_id = b.id and e.account = 'partner_escrow' and e.direction = 'debit'), 0) escrow,
           coalesce((select sum(amount_kobo) from public.payout_instructions p where p.booking_id = b.id), 0) instructed,
           pg_temp.held(b.id) held,
           b.rent_kobo - b.commitment_fee_kobo + b.agent_fee_kobo expected_held
      from public.bookings b
     where b.lodge_id in (select id from public.lodges where title = 'Money test lodge')
  loop
    assert r.escrow = r.instructed + r.held,
      format('booking %s: escrow %s <> instructed %s + held %s', r.id, r.escrow, r.instructed, r.held);
    if r.status in ('MOVE_IN_CONFIRMED', 'AUTO_CONFIRMED', 'STUDENT_CANCELLED') then
      assert r.held = 0, format('booking %s (%s) still holds %s', r.id, r.status, r.held);
    elsif r.status in ('PAID_HELD', 'DISPUTED') then
      assert r.held = r.expected_held, format('booking %s holds %s, expected %s', r.id, r.held, r.expected_held);
    else
      assert r.escrow = 0 and r.held = 0, format('unpaid booking %s has money (%s)', r.id, r.status);
    end if;
  end loop;

  -- One ledger credit per instruction (same txn, amount, payee account) and no payee credit without an instruction.
  assert not exists (
    select 1 from public.payout_instructions p
     where (select count(*) from public.ledger_entries e
             where e.txn_id = p.txn_id and e.booking_id = p.booking_id and e.direction = 'credit'
               and e.amount_kobo = p.amount_kobo and e.account like '%:' || p.payee_id) < 1),
    'payout instruction without matching ledger credit';
  assert (select count(*) from public.ledger_entries e
           where e.direction = 'credit' and e.account ~ '^(landlord|agent|student):')
       = (select count(*) from public.payout_instructions), 'payee ledger credits and instructions differ in number';
  assert not exists (select 1 from public.payout_instructions p join public.profiles pr on pr.id = p.payee_id
                      where pr.role = 'caretaker'), 'a caretaker was made a payee';
end $$;

do $tests$
declare
  -- people
  ll   uuid := pg_temp.mk_user('landlord', 'Lan Lord');
  ll2  uuid := pg_temp.mk_user('landlord', 'Unverified Landlord', false);
  ag   uuid := pg_temp.mk_user('agent', 'Ada Agent');
  ag2  uuid := pg_temp.mk_user('agent', 'Unverified Agent', false);
  ct   uuid := pg_temp.mk_user('caretaker', 'Cara Taker');
  s1   uuid := pg_temp.mk_user('student', 'Stu One');
  s2   uuid := pg_temp.mk_user('student', 'Stu Two');
  -- lodges (rent ₦300,000 = 30,000,000 kobo; agent fee 5% = 1,500,000; landlord commission 5% = 1,500,000)
  la   uuid; lc uuid; ln uuid; lu uuid;
  b    uuid; b2 uuid; r1 uuid; kind text; ok boolean;
  R constant bigint := 30000000; F constant bigint := 1500000; K constant bigint := 1500000;
begin
  la := pg_temp.mk_lodge(ll, ag, R, F, 0, 5, ct);
  lc := pg_temp.mk_lodge(ll, ag, R, F, 10);           -- 10% commitment fee = 3,000,000
  ln := pg_temp.mk_lodge(ll2, null, 20000000, 0);    -- direct listing, unverified landlord
  lu := pg_temp.mk_lodge(ll, ag2, R, F);              -- unverified agent

  -- ── setup guards
  begin perform pg_temp.mk_lodge(ll, null, R, F); assert false, 'agent fee without agent allowed';
  exception when check_violation then null; end;
  begin perform pg_temp.mk_lodge(ll, ct, R, F); assert false, 'caretaker accepted as agent';
  exception when raise_exception then null; end;
  begin perform pg_temp.mk_lodge(ll, ag, R, F, 0, 11); assert false, '11% landlord commission allowed';
  exception when check_violation then null; end;
  begin perform pg_temp.mk_lodge(ll, ag, R, F, 25); assert false, '25% commitment fee allowed';
  exception when check_violation then null; end;

  -- ── T1 standard: student confirms -> rent to landlord minus commission; agent gets fee + commission
  b := pg_temp.mk_booking(s1, la);
  assert (select agent_commission_kobo from public.bookings where id = b) = K, 'commission snapshot';
  assert pg_temp.pay(b) = 'paid', 'T1 pay';
  assert pg_temp.held(b) = R + F, 'T1 held after payment';
  assert (select auto_release_at is null and handover_at is null from public.bookings where id = b), 'T1 no clock at payment';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  assert public.confirm_move_in(b) = 'MOVE_IN_CONFIRMED', 'T1 confirm';
  reset role;
  assert pg_temp.instr(b, ll, 'rent') = R - K, 'T1 landlord rent';
  assert pg_temp.instr(b, ag, 'agent_fee') = F, 'T1 agent fee';
  assert pg_temp.instr(b, ag, 'landlord_commission') = K, 'T1 commission';
  assert pg_temp.instr_status(b, ll) = 'pending' and pg_temp.instr_status(b, ag) = 'pending', 'T1 verified payees pending';
  r1 := b;
  perform pg_temp.check_books();

  -- ── T2 commitment fee: 10% to landlord at payment, rest held; release nets it out
  b := pg_temp.mk_booking(s2, lc);
  perform pg_temp.pay(b);
  assert pg_temp.instr(b, ll, 'commitment_fee') = 3000000, 'T2 commitment at payment';
  assert pg_temp.held(b) = R - 3000000 + F, 'T2 held excludes commitment';
  perform pg_temp.check_books();
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  perform public.confirm_move_in(b);
  reset role;
  assert pg_temp.instr(b, ll, 'rent') = R - 3000000 - K, 'T2 landlord rent net of commitment and commission';
  assert pg_temp.instr(b, ll, 'rent') + pg_temp.instr(b, ll, 'commitment_fee') = R - K, 'T2 landlord total';
  perform pg_temp.check_books();

  -- ── T3 caretaker hands over; 48h clock starts at handover; auto-release after 48h
  b := pg_temp.mk_booking(s1, la);
  perform pg_temp.pay(b);
  update public.bookings set paid_at = now() - interval '10 days' where id = b;  -- payment age must not matter
  assert (public.run_booking_deadlines()->>'auto_released')::int = 0, 'T3 nothing to release before handover';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ct, 'role', 'authenticated')::text, true);
  perform public.mark_handover(b);
  begin perform public.confirm_move_in(b); assert false, 'T3 caretaker confirmed as student';
  exception when raise_exception then null; end;
  begin perform public.cancel_booking(b); assert false, 'T3 caretaker cancelled';
  exception when raise_exception then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  begin perform public.mark_handover(b); assert false, 'T3 stranger marked handover';
  exception when raise_exception then null; end;
  reset role;
  assert (select auto_release_at - handover_at = interval '48 hours' and handover_by = ct from public.bookings where id = b),
    'T3 auto_release_at = handover + 48h';
  assert (public.run_booking_deadlines()->>'auto_released')::int = 0, 'T3 not released before 48h';
  update public.bookings set auto_release_at = now() - interval '1 minute' where id = b;
  assert (public.run_booking_deadlines()->>'auto_released')::int = 1, 'T3 released after 48h';
  assert pg_temp.status(b) = 'AUTO_CONFIRMED', 'T3 status';
  assert pg_temp.instr(b, ll, 'rent') = R - K and pg_temp.instr(b, ag, 'agent_fee') = F
     and pg_temp.instr(b, ag, 'landlord_commission') = K, 'T3 split';
  assert pg_temp.instr_status(b, ct) is null, 'T3 caretaker got nothing';
  perform pg_temp.check_books();

  -- ── T4 dispute: allowed before the 48h window closes, blocked after; disputed money stays held
  b := pg_temp.mk_booking(s1, la);
  perform pg_temp.pay(b);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ll, 'role', 'authenticated')::text, true);
  perform public.mark_handover(b);
  reset role;
  update public.bookings set auto_release_at = now() - interval '1 minute' where id = b;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  begin perform public.raise_dispute(b, 'Lodge does not match the listing'); assert false, 'T4 late dispute allowed';
  exception when raise_exception then null; end;
  reset role;
  b2 := pg_temp.mk_booking(s2, la);
  perform pg_temp.pay(b2);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  perform public.raise_dispute(b2, 'Lodge does not match the listing');
  reset role;
  assert pg_temp.status(b2) = 'DISPUTED' and pg_temp.held(b2) = R + F, 'T4 disputed money held';
  perform public.run_booking_deadlines();  -- releases b (window passed), never b2
  assert pg_temp.status(b2) = 'DISPUTED', 'T4 dispute not auto-released';
  perform pg_temp.check_books();

  -- ── T5 grace cancellation (within 24h, before handover): full held refund; commitment stays with landlord
  b := pg_temp.mk_booking(s2, lc);
  perform pg_temp.pay(b);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  assert public.cancel_booking(b) = 'grace', 'T5 grace';
  reset role;
  assert pg_temp.instr(b, s2, 'refund') = R - 3000000 + F, 'T5 refund = everything held';
  assert pg_temp.instr(b, ll, 'late_cancel_compensation') = 0, 'T5 no compensation';
  assert pg_temp.instr(b, ll, 'commitment_fee') = 3000000, 'T5 commitment kept';
  perform pg_temp.check_books();

  -- ── T6 late cancellation (after 24h): landlord 10% of rent from held funds, rest refunded
  b := pg_temp.mk_booking(s1, la);
  perform pg_temp.pay(b);
  update public.bookings set paid_at = now() - interval '25 hours' where id = b;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  assert public.cancel_booking(b) = 'late', 'T6 late';
  reset role;
  assert pg_temp.instr(b, ll, 'late_cancel_compensation') = R / 10, 'T6 compensation 10%';
  assert pg_temp.instr(b, s1, 'refund') = R + F - R / 10, 'T6 refund rest (agent fee refunded)';
  assert pg_temp.instr(b, ag, 'agent_fee') = 0 and pg_temp.instr(b, ag, 'landlord_commission') = 0, 'T6 agent unpaid';
  perform pg_temp.check_books();

  -- ── T7 cancellation within 24h but after handover is late
  b := pg_temp.mk_booking(s1, la);
  perform pg_temp.pay(b);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ag, 'role', 'authenticated')::text, true);
  perform public.mark_handover(b);
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  assert public.cancel_booking(b) = 'late', 'T7 late after handover';
  reset role;
  assert pg_temp.instr(b, ll, 'late_cancel_compensation') = R / 10, 'T7 compensation';
  perform pg_temp.check_books();

  -- ── T8 late cancellation with commitment already >= 10%: no extra compensation
  b := pg_temp.mk_booking(s2, lc);
  perform pg_temp.pay(b);
  update public.bookings set paid_at = now() - interval '2 days' where id = b;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  perform public.cancel_booking(b);
  reset role;
  assert pg_temp.instr(b, ll, 'late_cancel_compensation') = 0, 'T8 commitment covers compensation';
  assert pg_temp.instr(b, s2, 'refund') = R - 3000000 + F, 'T8 full held refund';
  perform pg_temp.check_books();

  -- ── T9 no-show: no handover, no confirmation by move_in_date + 7 -> student-fault cancellation
  b := pg_temp.mk_booking(s1, la, ((now() at time zone 'Africa/Lagos')::date - 8));
  perform pg_temp.pay(b);
  b2 := pg_temp.mk_booking(s2, la, ((now() at time zone 'Africa/Lagos')::date - 7));  -- day 7 itself: not yet
  perform pg_temp.pay(b2);
  assert (public.run_booking_deadlines()->>'no_shows')::int = 1, 'T9 exactly one no-show';
  assert pg_temp.status(b) = 'STUDENT_CANCELLED' and pg_temp.status(b2) = 'PAID_HELD', 'T9 statuses';
  assert (select cancellation_kind from public.bookings where id = b) = 'no_show', 'T9 kind';
  assert pg_temp.instr(b, ll, 'late_cancel_compensation') = R / 10 and pg_temp.instr(b, s1, 'refund') = R + F - R / 10,
    'T9 no-show split';
  -- With a handover the no-show rule never applies; the 48h path does.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ll, 'role', 'authenticated')::text, true);
  perform public.mark_handover(b2);
  reset role;
  update public.bookings set move_in_date = move_in_date where id = b2;  -- no-op touch
  perform public.run_booking_deadlines();
  assert pg_temp.status(b2) = 'PAID_HELD', 'T9 handed-over booking is not a no-show';
  perform pg_temp.check_books();

  -- ── T10 payee mandate: rent goes to the agent ONLY with a signed mandate naming the verified lodge agent
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ag, 'role', 'authenticated')::text, true);
  begin perform public.sign_payee_mandate(la, ag, 't'); assert false, 'T10 agent signed own mandate';
  exception when raise_exception then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', ll, 'role', 'authenticated')::text, true);
  begin perform public.sign_payee_mandate(lu, ag2, 't'); assert false, 'T10 mandate to unverified agent';
  exception when raise_exception then null; end;
  begin perform public.sign_payee_mandate(la, ct, 't'); assert false, 'T10 mandate to caretaker';
  exception when raise_exception then null; end;
  begin perform public.sign_payee_mandate(la, ag2, 't'); assert false, 'T10 mandate to agent not on lodge';
  exception when raise_exception then null; end;
  perform public.sign_payee_mandate(la, ag, 't');
  reset role;
  b := pg_temp.mk_booking(s1, la);
  perform pg_temp.pay(b);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  perform public.confirm_move_in(b);
  reset role;
  assert pg_temp.instr(b, ag, 'rent') = R - K and pg_temp.instr(b, ll, 'rent') = 0, 'T10 rent to agent under mandate';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ll, 'role', 'authenticated')::text, true);
  perform public.revoke_payee_mandate(la);
  reset role;
  b := pg_temp.mk_booking(s2, la);
  perform pg_temp.pay(b);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  perform public.confirm_move_in(b);
  reset role;
  assert pg_temp.instr(b, ll, 'rent') = R - K and pg_temp.instr(b, ag, 'rent') = 0, 'T10 rent back to landlord after revoke';
  perform pg_temp.check_books();

  -- ── T11 renewal: no student agent fee; linked agent earns 2.5% of new rent from the landlord's share
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  begin perform public.create_booking(la, current_date + 300, r1); assert false, 'T11 renewal of someone else''s tenancy';
  exception when raise_exception then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  b := public.create_booking(la, current_date + 300, r1);
  begin perform public.create_booking(la, current_date + 301, r1); assert false, 'T11 second renewal of same tenancy';
  exception when unique_violation then null; end;
  reset role;
  assert (select agent_fee_kobo = 0 and agent_commission_kobo = R * 25 / 1000 and agent_id = ag
            from public.bookings where id = b), 'T11 renewal terms';
  assert pg_temp.pay(b) = 'paid', 'T11 pay rent only';
  assert pg_temp.held(b) = R, 'T11 held = rent';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  perform public.confirm_move_in(b);
  reset role;
  assert pg_temp.instr(b, ag, 'renewal_bonus') = 750000, 'T11 renewal bonus 2.5%';
  assert pg_temp.instr(b, ll, 'rent') = R - 750000, 'T11 landlord rent';
  assert pg_temp.instr(b, ag, 'agent_fee') = 0 and pg_temp.instr(b, ag, 'landlord_commission') = 0, 'T11 no other agent pay';
  perform pg_temp.check_books();

  -- ── T12 direct listing + unverified landlord: full rent, held back until KYC
  b := pg_temp.mk_booking(s1, ln);
  assert (select agent_fee_kobo = 0 and agent_commission_kobo = 0 and agent_id is null from public.bookings where id = b),
    'T12 no agent money';
  perform pg_temp.pay(b);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  perform public.confirm_move_in(b);
  reset role;
  assert pg_temp.instr(b, ll2, 'rent') = 20000000 and pg_temp.instr_status(b, ll2) = 'awaiting_kyc', 'T12 awaiting KYC';
  perform pg_temp.check_books();

  -- ── T13 unverified agent: agent payouts held back for KYC, landlord paid
  b := pg_temp.mk_booking(s2, lu);
  perform pg_temp.pay(b);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role', 'authenticated')::text, true);
  perform public.confirm_move_in(b);
  reset role;
  assert pg_temp.instr_status(b, ag2) = 'awaiting_kyc' and pg_temp.instr_status(b, ll) = 'pending', 'T13 statuses';
  assert pg_temp.instr(b, ll, 'rent') = R - K, 'T13 rent to landlord, never the unverified agent';
  perform pg_temp.check_books();

  -- ── T14 create_booking validation
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  begin perform public.create_booking(la, current_date - 1); assert false, 'T14 past move-in date';
  exception when raise_exception then null; end;
  begin perform public.create_booking(la, current_date + 401); assert false, 'T14 move-in > 400 days';
  exception when raise_exception then null; end;
  b := public.create_booking(la, current_date + 10);
  assert public.create_booking(la, current_date + 10) = b, 'T14 same draft reused';
  perform set_config('request.jwt.claims', json_build_object('sub', ll, 'role', 'authenticated')::text, true);
  begin perform public.create_booking(la, current_date + 10); assert false, 'T14 landlord booked';
  exception when raise_exception then null; end;
  reset role;

  -- ── T15 guards: terms immutable; no release without the student or the 48h rule
  b := pg_temp.mk_booking(s1, la);
  perform pg_temp.pay(b);
  begin update public.bookings set agent_commission_kobo = 0 where id = b; assert false, 'T15 commission changed';
  exception when raise_exception then null; end;
  begin update public.bookings set status = 'MOVE_IN_CONFIRMED' where id = b; assert false, 'T15 release without student';
  exception when raise_exception then null; end;
  begin update public.bookings set status = 'AUTO_CONFIRMED' where id = b; assert false, 'T15 auto-release without handover';
  exception when raise_exception then null; end;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', s1, 'role', 'authenticated')::text, true);
  perform public.confirm_move_in(b);
  begin perform public.confirm_move_in(b); assert false, 'T15 double release';
  exception when raise_exception then null; end;
  begin perform public.cancel_booking(b); assert false, 'T15 cancel after release';
  exception when raise_exception then null; end;
  reset role;
  begin perform private.instruct(gen_random_uuid(), b, ct, 'rent', 1); assert false, 'T15 caretaker payee';
  exception when raise_exception then null; end;
  perform pg_temp.check_books();

  -- ── T16 payment edge cases: wrong amount and double payment never touch the hold
  b := pg_temp.mk_booking(s2, la);
  insert into public.payment_attempts (booking_id, txn_ref, amount_kobo) values (b, 'LL-MT00000000000001', R + F);
  assert public.record_payment('LL-MT00000000000001', '00', R, 'P') = 'amount_mismatch', 'T16 mismatch';
  assert pg_temp.status(b) = 'DRAFT' and pg_temp.held(b) = 0, 'T16 nothing held on mismatch';
  assert pg_temp.pay(b) = 'paid', 'T16 pay';
  insert into public.payment_attempts (booking_id, txn_ref, amount_kobo) values (b, 'LL-MT00000000000002', R + F);
  assert public.record_payment('LL-MT00000000000002', '00', R + F, 'P2') = 'duplicate_payment', 'T16 duplicate';
  assert pg_temp.held(b) = R + F, 'T16 duplicate not double-held';
  assert public.record_payment('LL-MT00000000000002', '00', R + F, 'P2') = 'duplicate_payment', 'T16 idempotent';
  perform pg_temp.check_books();

  -- ── Self-test: the invariant checker and the DB's own balance trigger both reject an unbalanced txn.
  begin
    insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo)
      values (gen_random_uuid(), r1, 'held:booking:' || r1, 'debit', 1);
    perform pg_temp.check_books();
    assert false, 'check_books missed an unbalanced txn';
  exception when raise_exception then null; end;
  begin
    insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo)
      values (gen_random_uuid(), r1, 'held:booking:' || r1, 'debit', 1);
    set constraints all immediate;  -- ledger_balanced is deferred to commit; force it now
    assert false, 'ledger_balanced trigger missed an unbalanced txn';
  exception when raise_exception then null; end;
  perform pg_temp.check_books();

  raise notice 'all money path tests passed';
end $tests$;

rollback;
