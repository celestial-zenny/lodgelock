-- 0005: release rule = BOTH parties confirm "keys handed over".
--   * Student and landlord/agent each tap "Keys handed over" (confirm_keys_handover).
--     When both have confirmed: PAID_HELD -> MOVE_IN_CONFIRMED and the payout is booked in the ledger that moment
--     (same-day payout instruction).
--   * 72h fallback, only when the landlord confirmed and the student never responded (no confirmation, no dispute):
--     the 72h window starts at the landlord's confirmation. Before the landlord confirms there is no deadline.
--   * Optional commitment fee (10-20% of rent, per lodge, default off) is released to the landlord at payment
--     and is NOT refundable through the hold. It is shown to the student before paying.
-- confirm_move_in is replaced by confirm_keys_handover.

-- ─────────────────────────────────────────────────────────────── columns
alter table public.lodges
  add column commitment_fee_pct smallint not null default 0
    constraint commitment_fee_pct_range check (commitment_fee_pct = 0 or commitment_fee_pct between 10 and 20);

alter table public.bookings
  add column commitment_fee_kobo        bigint not null default 0 check (commitment_fee_kobo >= 0),
  add column student_keys_confirmed_at  timestamptz,
  add column landlord_keys_confirmed_at timestamptz,
  add constraint commitment_within_rent check (commitment_fee_kobo * 5 <= rent_kobo); -- never above 20%

comment on column public.bookings.move_in_deadline is
  'Fallback deadline: landlord_keys_confirmed_at + 72h. Null until the landlord confirms the handover.';

-- Existing held bookings: no landlord confirmation yet, so no fallback deadline.
alter table public.bookings disable trigger bookings_guard;
update public.bookings set move_in_deadline = null where status = 'PAID_HELD';
alter table public.bookings enable trigger bookings_guard;

-- ─────────────────────────────────────────────────────────────── guard
create or replace function private.bookings_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare l public.lodges;
begin
  if tg_op = 'INSERT' then
    select * into l from public.lodges where id = new.lodge_id;
    if l.id is null or l.status <> 'verified' then
      raise exception 'lodge is not bookable';
    end if;
    new.status              := 'DRAFT';
    new.rent_kobo           := l.rent_kobo;
    new.agent_fee_kobo      := l.agent_fee_kobo;
    new.commitment_fee_kobo := l.rent_kobo * l.commitment_fee_pct / 100;  -- integer kobo, rounds down
    new.payment_ref         := null;
    new.paid_at             := null;
    new.move_in_deadline    := null;
    new.student_keys_confirmed_at  := null;
    new.landlord_keys_confirmed_at := null;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, reason)
      values (new.id, null, 'DRAFT', auth.uid(), 'created');
    return new;
  end if;

  -- Price and parties are immutable after creation.
  if new.student_id <> old.student_id or new.lodge_id <> old.lodge_id
     or new.rent_kobo <> old.rent_kobo or new.agent_fee_kobo <> old.agent_fee_kobo
     or new.commitment_fee_kobo <> old.commitment_fee_kobo then
    raise exception 'booking parties and price are immutable';
  end if;
  -- A confirmation, once given, can't be withdrawn or back-dated.
  if (old.student_keys_confirmed_at is not null and new.student_keys_confirmed_at is distinct from old.student_keys_confirmed_at)
     or (old.landlord_keys_confirmed_at is not null and new.landlord_keys_confirmed_at is distinct from old.landlord_keys_confirmed_at) then
    raise exception 'keys handover confirmations are final';
  end if;

  if new.status is distinct from old.status then
    if not exists (select 1 from public.booking_transitions
                   where from_status = old.status and to_status = new.status) then
      raise exception 'illegal booking transition % -> %', old.status, new.status;
    end if;
    if new.status = 'PAID_HELD' then
      new.paid_at          := coalesce(new.paid_at, now());
      new.move_in_deadline := null;
    end if;
    if new.status = 'MOVE_IN_CONFIRMED'
       and (new.student_keys_confirmed_at is null or new.landlord_keys_confirmed_at is null) then
      raise exception 'both student and landlord must confirm the keys handover';
    end if;
    if new.status = 'AUTO_CONFIRMED'
       and (new.landlord_keys_confirmed_at is null or new.student_keys_confirmed_at is not null
            or new.move_in_deadline is null or new.move_in_deadline >= now()) then
      raise exception 'auto-confirm only after landlord handover and 72h without a student response';
    end if;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, reason)
      values (new.id, old.status, new.status, auth.uid(),
              nullif(current_setting('lodgelock.transition_reason', true), ''));
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────── payout booking
-- Moves the still-held amount to what the landlord/agent are owed. The transfer itself (PAID_OUT) is a
-- separate step done by the server through the payment partner; this records the instruction, same day.
create function private.book_release(p_booking uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  b   public.bookings;
  l   public.lodges;
  txn uuid := gen_random_uuid();
  rent_due bigint;
begin
  select * into b from public.bookings where id = p_booking;
  select * into l from public.lodges where id = b.lodge_id;
  rent_due := b.rent_kobo - b.commitment_fee_kobo;
  if rent_due > 0 then
    insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref) values
      (txn, b.id, 'held:booking:' || b.id, 'debit',  rent_due, b.payment_ref),
      (txn, b.id, 'landlord:' || l.owner_id, 'credit', rent_due, b.payment_ref);
  end if;
  if b.agent_fee_kobo > 0 then
    insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref) values
      (txn, b.id, 'held:booking:' || b.id, 'debit',  b.agent_fee_kobo, b.payment_ref),
      (txn, b.id, 'agent:' || coalesce(l.agent_id, l.owner_id), 'credit', b.agent_fee_kobo, b.payment_ref);
  end if;
end $$;
revoke execute on function private.book_release(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────── confirmations
-- Called by the student OR the lodge's landlord/agent. Idempotent per party.
-- Returns the booking status afterwards.
drop function public.confirm_move_in(uuid);

create function public.confirm_keys_handover(p_booking uuid)
returns public.booking_status language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  b   public.bookings;
  l   public.lodges;
  is_student boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  select * into l from public.lodges where id = b.lodge_id;

  is_student := b.student_id = uid;
  if not is_student and uid is distinct from l.owner_id and uid is distinct from l.agent_id then
    raise exception 'booking not found';
  end if;
  if b.status <> 'PAID_HELD' then raise exception 'booking is not awaiting handover'; end if;

  if is_student then
    if b.student_keys_confirmed_at is null then
      update public.bookings set student_keys_confirmed_at = now() where id = b.id returning * into b;
    end if;
  else
    if b.landlord_keys_confirmed_at is null then
      -- Starts the 72h fallback window for an unresponsive student.
      update public.bookings
         set landlord_keys_confirmed_at = now(),
             move_in_deadline = case when student_keys_confirmed_at is null then now() + interval '72 hours' end
       where id = b.id returning * into b;
    end if;
  end if;

  if b.student_keys_confirmed_at is not null and b.landlord_keys_confirmed_at is not null then
    perform set_config('lodgelock.transition_reason', 'keys handover confirmed by student and landlord', true);
    update public.bookings set status = 'MOVE_IN_CONFIRMED', move_in_deadline = null where id = b.id;
    perform private.book_release(b.id);
    return 'MOVE_IN_CONFIRMED';
  end if;
  return b.status;
end $$;
revoke execute on function public.confirm_keys_handover(uuid) from public, anon;
grant execute on function public.confirm_keys_handover(uuid) to authenticated;

-- Disputes: open while the money is held and the fallback window (if started) hasn't closed.
create or replace function public.raise_dispute(p_booking uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare d_id uuid;
begin
  perform set_config('lodgelock.transition_reason', 'student raised dispute', true);
  update public.bookings set status = 'DISPUTED'
   where id = p_booking and student_id = auth.uid() and status = 'PAID_HELD'
     and (move_in_deadline is null or now() <= move_in_deadline);
  if not found then raise exception 'booking not found, not disputable, or window closed'; end if;
  insert into public.disputes (booking_id, raised_by, reason)
    values (p_booking, auth.uid(), p_reason) returning id into d_id;
  return d_id;
end $$;

-- ─────────────────────────────────────────────────────────────── 72h fallback
create or replace function private.auto_confirm_expired()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  perform set_config('lodgelock.transition_reason', 'student did not respond within 72h of landlord handover', true);
  for r in
    select id from public.bookings
     where status = 'PAID_HELD' and landlord_keys_confirmed_at is not null
       and student_keys_confirmed_at is null and move_in_deadline < now()
     for update skip locked
  loop
    update public.bookings set status = 'AUTO_CONFIRMED' where id = r.id;
    perform private.book_release(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function private.auto_confirm_expired() from public, anon, authenticated;

-- Service-role entry point for the cron route (private schema isn't exposed over the API).
create function public.run_auto_confirm()
returns integer language sql security definer set search_path = ''
as $$ select private.auto_confirm_expired() $$;
revoke execute on function public.run_auto_confirm() from public, anon, authenticated;
grant execute on function public.run_auto_confirm() to service_role;

-- ─────────────────────────────────────────────────────────────── payment: release commitment fee
-- Same as 0003 except the ledger split: the commitment fee goes straight to the landlord at payment.
create or replace function public.record_payment(
  p_txn_ref text, p_response_code text, p_amount_kobo bigint, p_provider_ref text
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  a   public.payment_attempts;
  b   public.bookings;
  l   public.lodges;
  txn uuid := gen_random_uuid();
begin
  select * into a from public.payment_attempts where txn_ref = p_txn_ref for update;
  if a.id is null then return 'unknown_ref'; end if;
  select * into b from public.bookings where id = a.booking_id for update;

  if a.status = 'succeeded' then return 'already_paid'; end if;

  if p_response_code is distinct from '00' then
    update public.payment_attempts set last_response_code = p_response_code where id = a.id;
    return 'pending';
  end if;

  if p_amount_kobo is distinct from a.amount_kobo
     or a.amount_kobo <> b.rent_kobo + b.agent_fee_kobo then
    update public.payment_attempts
       set status = 'needs_refund', last_response_code = p_response_code,
           provider_payment_ref = p_provider_ref, settled_at = now()
     where id = a.id;
    return 'amount_mismatch';
  end if;

  if b.status <> 'DRAFT' then
    update public.payment_attempts
       set status = 'needs_refund', last_response_code = p_response_code,
           provider_payment_ref = p_provider_ref, settled_at = now()
     where id = a.id;
    return 'duplicate_payment';
  end if;

  update public.payment_attempts
     set status = 'succeeded', last_response_code = p_response_code,
         provider_payment_ref = p_provider_ref, settled_at = now()
   where id = a.id;

  perform set_config('lodgelock.transition_reason', 'payment verified by requery', true);
  update public.bookings set status = 'PAID_HELD', payment_ref = a.txn_ref where id = b.id;

  insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref) values
    (txn, b.id, 'partner_escrow',        'debit',  a.amount_kobo, p_provider_ref),
    (txn, b.id, 'held:booking:' || b.id, 'credit', a.amount_kobo - b.commitment_fee_kobo, p_provider_ref);
  if b.commitment_fee_kobo > 0 then
    select * into l from public.lodges where id = b.lodge_id;
    insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref) values
      (txn, b.id, 'landlord:' || l.owner_id, 'credit', b.commitment_fee_kobo, p_provider_ref);
  end if;
  return 'paid';
end $$;
revoke execute on function public.record_payment(text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_payment(text, text, bigint, text) to service_role;
