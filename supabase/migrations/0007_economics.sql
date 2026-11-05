-- 0007: landlord/agent economics. Replaces the 0005 two-sided handover rule.
--
-- Release:   student confirms move-in -> release now; OR landlord/agent/caretaker marks handover and the student
--            doesn't respond within 48h -> auto-release. The clock starts at handover, never at payment.
-- No-show:   no handover and no student confirmation by move_in_date + 7 days -> STUDENT_CANCELLED (no_show).
-- Split:     one payment, split at release into payout instructions:
--              rent  (rent - commitment fee - landlord-paid commission) -> landlord, or the agent ONLY under a signed,
--                    active payee mandate naming the booking's KYC-verified agent;
--              agent -> student-paid agent fee (<= 5% of rent, existing cap)
--                       + landlord-paid commission (lodge-declared, default 5%, 0-10%, deducted from the landlord's share).
--            Instructions to an unverified landlord/agent are recorded as awaiting_kyc, never sent.
-- Renewal:   booking with renewal_of -> no student agent fee; the linked agent earns 2.5% of the new rent,
--            deducted from the landlord's share (replaces the normal commission).
-- Cancel:    student cancels with no landlord fault (not a dispute). Free within 24h of payment and before handover.
--            After that (and for no-shows) the landlord receives 10% of rent from held funds, minus any commitment fee
--            they already received; the rest of the held amount is refunded to the student.
-- Caretaker: can be assigned to a lodge, see its bookings and mark handover. Never a payee (enforced in private.instruct).
--
-- All amounts integer kobo, rounded down. Every ledger txn balances (ledger_balanced trigger).

-- ─────────────────────────────────────────────────────────────── lodges
alter table public.lodges
  add column landlord_commission_pct smallint not null default 5
    constraint landlord_commission_pct_range check (landlord_commission_pct between 0 and 10),
  add column caretaker_id uuid references public.profiles (id),
  add constraint agent_fee_needs_agent check (agent_id is not null or agent_fee_kobo = 0);

-- Agent / caretaker links must point at the right kind of account. Definer helper: the guard runs as the
-- calling user, whose RLS can't see other people's profiles.
create function private.profile_has_role(p_id uuid, p_role public.user_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = p_id and role = p_role) $$;
revoke execute on function private.profile_has_role(uuid, public.user_role) from public, anon;
grant execute on function private.profile_has_role(uuid, public.user_role) to authenticated;

create or replace function private.lodges_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.agent_id is not null and not private.profile_has_role(new.agent_id, 'agent') then
    raise exception 'agent_id must be an agent account';
  end if;
  if new.caretaker_id is not null and not private.profile_has_role(new.caretaker_id, 'caretaker') then
    raise exception 'caretaker_id must be a caretaker account';
  end if;
  if private.is_privileged() then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.is_demo := false;
  else
    new.status := case when old.status = 'verified' then 'pending_review' else old.status end;
    new.owner_id := old.owner_id;
    new.is_demo := old.is_demo;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Caretakers see the lodges they look after.
drop policy lodges_public on public.lodges;
create policy lodges_public on public.lodges for select to anon, authenticated
  using (status = 'verified' or owner_id = (select auth.uid()) or agent_id = (select auth.uid())
         or caretaker_id = (select auth.uid()) or (select private.is_admin()));

-- ─────────────────────────────────────────────────────────────── bookings
alter table public.bookings rename column student_keys_confirmed_at to student_confirmed_at;
alter table public.bookings rename column landlord_keys_confirmed_at to handover_at;
alter table public.bookings rename column move_in_deadline to auto_release_at;
comment on column public.bookings.auto_release_at is 'handover_at + 48h. Null until a handover is marked.';

alter table public.bookings
  add column move_in_date          date,
  add column handover_by           uuid references public.profiles (id),
  add column agent_id              uuid references public.profiles (id),   -- snapshot of the lodge's agent at booking
  add column agent_commission_kobo bigint not null default 0 check (agent_commission_kobo >= 0), -- landlord-paid
  add column renewal_of            uuid references public.bookings (id),
  add column cancellation_kind     text check (cancellation_kind in ('grace', 'late', 'no_show')),
  add column cancelled_at          timestamptz,
  add constraint landlord_deductions_within_rent check (commitment_fee_kobo + agent_commission_kobo <= rent_kobo);

-- Backfill existing bookings (terms they were created under: no landlord-paid commission).
alter table public.bookings disable trigger bookings_guard;
update public.bookings b
   set agent_id = l.agent_id,
       agent_fee_kobo = case when l.agent_id is null then 0 else b.agent_fee_kobo end,
       move_in_date = coalesce(b.move_in_date, ((coalesce(b.paid_at, b.created_at)) at time zone 'Africa/Lagos')::date),
       auto_release_at = case when b.handover_at is not null and b.status = 'PAID_HELD' then b.handover_at + interval '48 hours' end
  from public.lodges l
 where l.id = b.lodge_id;
alter table public.bookings enable trigger bookings_guard;
alter table public.bookings alter column move_in_date set not null;
alter table public.bookings
  add constraint agent_money_needs_agent check (agent_id is not null or (agent_fee_kobo = 0 and agent_commission_kobo = 0));

create unique index bookings_one_renewal on public.bookings (renewal_of)
  where renewal_of is not null and status not in ('CANCELLED', 'STUDENT_CANCELLED', 'REFUNDED');
create index on public.bookings (status, auto_release_at);
create index on public.bookings (status, move_in_date);

insert into public.booking_transitions values ('PAID_HELD', 'STUDENT_CANCELLED') on conflict do nothing;

drop policy bookings_read on public.bookings;
create policy bookings_read on public.bookings for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin())
         or exists (select 1 from public.lodges l where l.id = lodge_id
                    and (l.owner_id = (select auth.uid()) or l.agent_id = (select auth.uid())
                         or l.caretaker_id = (select auth.uid()))));

create or replace function private.bookings_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  l     public.lodges;
  prev  public.bookings;
begin
  if tg_op = 'INSERT' then
    select * into l from public.lodges where id = new.lodge_id;
    if l.id is null or l.status <> 'verified' then
      raise exception 'lodge is not bookable';
    end if;
    if new.move_in_date is null then raise exception 'move-in date required'; end if;
    new.status              := 'DRAFT';
    new.rent_kobo           := l.rent_kobo;
    new.commitment_fee_kobo := l.rent_kobo * l.commitment_fee_pct / 100;
    if new.renewal_of is not null then
      select * into prev from public.bookings where id = new.renewal_of;
      -- Renewal: student pays no agent fee; the linked agent earns 2.5% of the new rent from the landlord's share.
      new.agent_id              := coalesce(prev.agent_id, l.agent_id);
      new.agent_fee_kobo        := 0;
      new.agent_commission_kobo := case when new.agent_id is null then 0 else l.rent_kobo * 25 / 1000 end;
    else
      new.agent_id              := l.agent_id;
      new.agent_fee_kobo        := case when l.agent_id is null then 0 else l.agent_fee_kobo end;
      new.agent_commission_kobo := case when l.agent_id is null then 0
                                        else l.rent_kobo * l.landlord_commission_pct / 100 end;
    end if;
    new.payment_ref       := null;
    new.paid_at           := null;
    new.auto_release_at   := null;
    new.handover_at       := null;
    new.handover_by       := null;
    new.student_confirmed_at := null;
    new.cancellation_kind := null;
    new.cancelled_at      := null;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, reason)
      values (new.id, null, 'DRAFT', auth.uid(), case when new.renewal_of is null then 'created' else 'renewal created' end);
    return new;
  end if;

  -- Price, parties and terms are immutable after creation.
  if new.student_id <> old.student_id or new.lodge_id <> old.lodge_id
     or new.rent_kobo <> old.rent_kobo or new.agent_fee_kobo <> old.agent_fee_kobo
     or new.commitment_fee_kobo <> old.commitment_fee_kobo or new.agent_commission_kobo <> old.agent_commission_kobo
     or new.agent_id is distinct from old.agent_id or new.renewal_of is distinct from old.renewal_of
     or new.move_in_date <> old.move_in_date then
    raise exception 'booking parties, price and terms are immutable';
  end if;
  if (old.student_confirmed_at is not null and new.student_confirmed_at is distinct from old.student_confirmed_at)
     or (old.handover_at is not null and new.handover_at is distinct from old.handover_at) then
    raise exception 'handover and move-in confirmations are final';
  end if;

  if new.status is distinct from old.status then
    if not exists (select 1 from public.booking_transitions
                   where from_status = old.status and to_status = new.status) then
      raise exception 'illegal booking transition % -> %', old.status, new.status;
    end if;
    if new.status = 'PAID_HELD' then
      new.paid_at         := coalesce(new.paid_at, now());
      new.auto_release_at := null;
    end if;
    if new.status = 'MOVE_IN_CONFIRMED' and new.student_confirmed_at is null then
      raise exception 'only the student''s confirmation releases a booking';
    end if;
    if new.status = 'AUTO_CONFIRMED'
       and (new.handover_at is null or new.student_confirmed_at is not null
            or new.auto_release_at is null or new.auto_release_at >= now()) then
      raise exception 'auto-release only 48h after handover without a student response';
    end if;
    if new.status = 'STUDENT_CANCELLED' and (new.cancellation_kind is null or new.cancelled_at is null) then
      raise exception 'cancellation kind required';
    end if;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, reason)
      values (new.id, old.status, new.status, auth.uid(),
              nullif(current_setting('lodgelock.transition_reason', true), ''));
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────── payee mandates
-- The ONLY way rent can be paid to an agent: the landlord signs a mandate naming the lodge's KYC-verified agent.
create table public.payee_mandates (
  id              uuid primary key default gen_random_uuid(),
  lodge_id        uuid not null references public.lodges (id) on delete cascade,
  landlord_id     uuid not null references public.profiles (id),
  agent_id        uuid not null references public.profiles (id),
  policy_version  text not null check (char_length(policy_version) <= 32),
  signed_at       timestamptz not null default now(),
  revoked_at      timestamptz
);
create unique index payee_mandates_one_active on public.payee_mandates (lodge_id) where revoked_at is null;
alter table public.payee_mandates enable row level security;
create policy mandates_read on public.payee_mandates for select to authenticated
  using (landlord_id = (select auth.uid()) or agent_id = (select auth.uid()) or (select private.is_admin()));
-- No write policies: sign_payee_mandate / revoke_payee_mandate only.

create function public.sign_payee_mandate(p_lodge uuid, p_agent uuid, p_policy_version text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  l   public.lodges;
  m   uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into l from public.lodges where id = p_lodge for update;
  if l.id is null or l.owner_id <> uid then raise exception 'lodge not found'; end if;
  if not exists (select 1 from public.profiles where id = uid and identity_verified_at is not null) then
    raise exception 'landlord must be verified';
  end if;
  if l.agent_id is null or l.agent_id <> p_agent then raise exception 'mandate must name this lodge''s agent'; end if;
  if not exists (select 1 from public.profiles where id = p_agent and role = 'agent' and identity_verified_at is not null) then
    raise exception 'agent must be KYC-verified';
  end if;
  update public.payee_mandates set revoked_at = now() where lodge_id = p_lodge and revoked_at is null;
  insert into public.payee_mandates (lodge_id, landlord_id, agent_id, policy_version)
    values (p_lodge, uid, p_agent, coalesce(p_policy_version, 'unknown')) returning id into m;
  return m;
end $$;

create function public.revoke_payee_mandate(p_lodge uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.payee_mandates set revoked_at = now()
   where lodge_id = p_lodge and revoked_at is null and landlord_id = auth.uid();
  if not found then raise exception 'no active mandate'; end if;
end $$;

-- ─────────────────────────────────────────────────────────────── caretakers
-- Landlord assigns a caretaker by email (or clears it with null). Doesn't send the listing back to review.
create function public.set_lodge_caretaker(p_lodge uuid, p_email text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c   uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform private.hit_rate_limit('set_caretaker:' || uid, 20, 3600);
  if not exists (select 1 from public.lodges where id = p_lodge and owner_id = uid) then
    raise exception 'lodge not found';
  end if;
  if p_email is not null then
    select p.id into c from auth.users u join public.profiles p on p.id = u.id
     where lower(u.email) = lower(trim(p_email)) and p.role = 'caretaker';
    if c is null then raise exception 'no caretaker account with that email'; end if;
  end if;
  update public.lodges set caretaker_id = c where id = p_lodge;
end $$;

-- Sign-up may now create caretaker accounts (18+, like landlords and agents).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  m        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_adult  boolean;
  v_role   public.user_role;
begin
  if jsonb_typeof(m->'is_adult') <> 'boolean' then
    raise exception 'age attestation required';
  end if;
  v_adult := (m->>'is_adult')::boolean;
  v_role  := coalesce(nullif(m->>'role', ''), 'student')::public.user_role;
  if v_role not in ('student', 'landlord', 'agent', 'caretaker') then
    raise exception 'role not allowed at sign-up';
  end if;
  if not v_adult and v_role <> 'student' then
    raise exception 'landlords, agents and caretakers must be 18+';
  end if;
  if coalesce((m->>'accepted_terms')::boolean, false) is not true then
    raise exception 'terms and privacy policy must be accepted';
  end if;

  insert into public.profiles (id, role, full_name, phone, is_adult, guardian_consent_at)
  values (new.id, v_role, m->>'full_name', nullif(m->>'phone', ''), v_adult,
          case when v_adult then null else now() end);

  if not v_adult then
    insert into public.guardian_consents (user_id, guardian_name, guardian_phone, relationship)
    values (new.id, m->>'guardian_name', m->>'guardian_phone', m->>'guardian_relationship');
  end if;

  insert into public.consents (user_id, purpose, policy_version)
  values (new.id, 'terms_and_privacy', coalesce(m->>'policy_version', 'unknown'));
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────── payout instructions
-- What the payment partner must pay out, per payee. Mirrors the ledger credits one to one.
create table public.payout_instructions (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings (id),
  txn_id       uuid not null,                 -- ledger txn this instruction belongs to
  payee_id     uuid not null references public.profiles (id),
  kind         text not null check (kind in ('rent', 'agent_fee', 'landlord_commission', 'renewal_bonus',
                                             'commitment_fee', 'late_cancel_compensation', 'refund')),
  amount_kobo  bigint not null check (amount_kobo > 0),
  status       text not null default 'pending' check (status in ('pending', 'awaiting_kyc', 'sent', 'failed')),
  created_at   timestamptz not null default now()
);
create index on public.payout_instructions (booking_id);
create index on public.payout_instructions (payee_id, created_at);
create index on public.payout_instructions (status) where status in ('pending', 'awaiting_kyc');
alter table public.payout_instructions enable row level security;
create policy payouts_read on public.payout_instructions for select to authenticated
  using (payee_id = (select auth.uid()) or (select private.is_admin()));

-- Credit a payee in the ledger and record the matching instruction.
-- Landlord/agent payouts need KYC; refunds go back to the student who paid.
create function private.instruct(p_txn uuid, p_booking uuid, p_payee uuid, p_kind text, p_amount bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  p public.profiles;
  acct text;
begin
  if p_amount <= 0 then return; end if;
  select * into p from public.profiles where id = p_payee;
  if p.id is null then raise exception 'payee not found'; end if;
  if p.role = 'caretaker' then raise exception 'caretakers never receive payouts'; end if;
  if p_kind = 'refund' then
    if p.role <> 'student' then raise exception 'refunds go to the student'; end if;
    acct := 'student:' || p.id;
  elsif p.role = 'landlord' then acct := 'landlord:' || p.id;
  elsif p.role = 'agent' then acct := 'agent:' || p.id;
  else raise exception 'payee % is not a landlord or agent', p.role;
  end if;
  insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo)
    values (p_txn, p_booking, acct, 'credit', p_amount);
  insert into public.payout_instructions (booking_id, txn_id, payee_id, kind, amount_kobo, status)
    values (p_booking, p_txn, p_payee, p_kind, p_amount,
            case when p_kind <> 'refund' and p.identity_verified_at is null then 'awaiting_kyc' else 'pending' end);
end $$;

-- Who gets the rent: the landlord, or the booking's agent only under an active mandate naming them (still verified).
create function private.rent_payee(p_booking uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.agent_id
       from public.bookings b
       join public.payee_mandates m on m.lodge_id = b.lodge_id and m.revoked_at is null and m.agent_id = b.agent_id
       join public.profiles a on a.id = m.agent_id and a.role = 'agent' and a.identity_verified_at is not null
      where b.id = p_booking),
    (select l.owner_id from public.bookings b join public.lodges l on l.id = b.lodge_id where b.id = p_booking))
$$;

-- Amount still held for a booking after payment (rent minus commitment fee already paid out, plus agent fee).
create function private.held_amount(b public.bookings)
returns bigint language sql immutable set search_path = ''
as $$ select b.rent_kobo - b.commitment_fee_kobo + b.agent_fee_kobo $$;

create or replace function private.book_release(p_booking uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  b   public.bookings;
  txn uuid := gen_random_uuid();
begin
  select * into b from public.bookings where id = p_booking;
  insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref)
    values (txn, b.id, 'held:booking:' || b.id, 'debit', private.held_amount(b), b.payment_ref);
  perform private.instruct(txn, b.id, private.rent_payee(b.id), 'rent',
                           b.rent_kobo - b.commitment_fee_kobo - b.agent_commission_kobo);
  if b.agent_id is not null then
    perform private.instruct(txn, b.id, b.agent_id, 'agent_fee', b.agent_fee_kobo);
    perform private.instruct(txn, b.id, b.agent_id,
                             case when b.renewal_of is null then 'landlord_commission' else 'renewal_bonus' end,
                             b.agent_commission_kobo);
  end if;
end $$;

-- Student-fault cancellation: refund minus late compensation (10% of rent, less commitment fee already paid).
create function private.book_cancellation(p_booking uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  b    public.bookings;
  l    public.lodges;
  txn  uuid := gen_random_uuid();
  comp bigint := 0;
begin
  select * into b from public.bookings where id = p_booking;
  select * into l from public.lodges where id = b.lodge_id;
  if b.cancellation_kind in ('late', 'no_show') then
    comp := greatest(0, b.rent_kobo / 10 - b.commitment_fee_kobo);
  end if;
  insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref)
    values (txn, b.id, 'held:booking:' || b.id, 'debit', private.held_amount(b), b.payment_ref);
  perform private.instruct(txn, b.id, l.owner_id, 'late_cancel_compensation', comp);
  perform private.instruct(txn, b.id, b.student_id, 'refund', private.held_amount(b) - comp);
end $$;

revoke execute on function private.instruct(uuid, uuid, uuid, text, bigint), private.rent_payee(uuid),
  private.held_amount(public.bookings), private.book_release(uuid), private.book_cancellation(uuid)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────── payment
create or replace function public.record_payment(
  p_txn_ref text, p_response_code text, p_amount_kobo bigint, p_provider_ref text
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  a   public.payment_attempts;
  b   public.bookings;
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
  update public.bookings set status = 'PAID_HELD', payment_ref = a.txn_ref where id = b.id returning * into b;

  insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref) values
    (txn, b.id, 'partner_escrow',        'debit',  a.amount_kobo, p_provider_ref),
    (txn, b.id, 'held:booking:' || b.id, 'credit', private.held_amount(b), p_provider_ref);
  perform private.instruct(txn, b.id, private.rent_payee(b.id), 'commitment_fee', b.commitment_fee_kobo);
  return 'paid';
end $$;
revoke execute on function public.record_payment(text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_payment(text, text, bigint, text) to service_role;

-- ─────────────────────────────────────────────────────────────── booking RPCs
drop function public.create_booking(uuid);
create function public.create_booking(p_lodge uuid, p_move_in_date date, p_renewal_of uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  p     public.profiles;
  prev  public.bookings;
  today date := (now() at time zone 'Africa/Lagos')::date;
  b_id  uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform private.hit_rate_limit('create_booking:' || uid, 10, 3600);

  select * into p from public.profiles where id = uid;
  if p.id is null or p.role <> 'student' then
    raise exception 'only students can book';
  end if;
  if not p.is_adult and not exists (
    select 1 from public.guardian_consents g where g.user_id = uid and g.confirmed_at is not null
  ) then
    raise exception 'guardian confirmation required' using errcode = 'P0403';
  end if;
  if p_move_in_date is null or p_move_in_date < today or p_move_in_date > today + 400 then
    raise exception 'move-in date must be between today and 400 days from now';
  end if;
  if p_renewal_of is not null then
    select * into prev from public.bookings where id = p_renewal_of;
    if prev.id is null or prev.student_id <> uid or prev.lodge_id <> p_lodge
       or prev.status not in ('MOVE_IN_CONFIRMED', 'AUTO_CONFIRMED', 'PAID_OUT') then
      raise exception 'renewal must follow a completed tenancy of this lodge';
    end if;
  end if;

  -- Reuse an unpaid booking with the same terms instead of piling up drafts.
  select id into b_id from public.bookings
   where student_id = uid and lodge_id = p_lodge and status = 'DRAFT'
     and move_in_date = p_move_in_date and renewal_of is not distinct from p_renewal_of
   order by created_at desc limit 1;
  if b_id is not null then return b_id; end if;

  -- Price, agent and fees are set by private.bookings_guard from the lodge row, never from the caller.
  insert into public.bookings (student_id, lodge_id, rent_kobo, agent_fee_kobo, move_in_date, renewal_of)
  values (uid, p_lodge, 0, 0, p_move_in_date, p_renewal_of) returning id into b_id;
  return b_id;
end $$;

-- Landlord, agent or caretaker marks the keys handed over; starts the 48h auto-release clock.
create function public.mark_handover(p_booking uuid)
returns public.booking_status language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  b   public.bookings;
  l   public.lodges;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null then raise exception 'booking not found'; end if;
  select * into l from public.lodges where id = b.lodge_id;
  if uid is distinct from l.owner_id and uid is distinct from l.agent_id and uid is distinct from l.caretaker_id then
    raise exception 'booking not found';
  end if;
  if b.status <> 'PAID_HELD' then raise exception 'booking is not awaiting handover'; end if;
  if b.handover_at is null then
    update public.bookings set handover_at = now(), handover_by = uid, auto_release_at = now() + interval '48 hours'
     where id = b.id;
  end if;
  return 'PAID_HELD';
end $$;

drop function if exists public.confirm_keys_handover(uuid);
-- Student confirms move-in: releases the payout now.
create function public.confirm_move_in(p_booking uuid)
returns public.booking_status language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('lodgelock.transition_reason', 'student confirmed move-in', true);
  update public.bookings set student_confirmed_at = now(), status = 'MOVE_IN_CONFIRMED', auto_release_at = null
   where id = p_booking and student_id = auth.uid() and status = 'PAID_HELD';
  if not found then raise exception 'booking not found or not awaiting move-in'; end if;
  perform private.book_release(p_booking);
  return 'MOVE_IN_CONFIRMED';
end $$;

-- Student cancels with no landlord fault. Returns the cancellation kind.
create function public.cancel_booking(p_booking uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  b    public.bookings;
  kind text;
begin
  select * into b from public.bookings where id = p_booking and student_id = auth.uid() for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if b.status <> 'PAID_HELD' then raise exception 'booking can''t be cancelled now'; end if;
  kind := case when b.handover_at is null and now() <= b.paid_at + interval '24 hours' then 'grace' else 'late' end;
  perform set_config('lodgelock.transition_reason',
                     case kind when 'grace' then 'student cancelled within grace period' else 'student cancelled late' end, true);
  update public.bookings set status = 'STUDENT_CANCELLED', cancellation_kind = kind, cancelled_at = now(),
                             auto_release_at = null
   where id = b.id;
  perform private.book_cancellation(b.id);
  return kind;
end $$;

-- Disputes (landlord fault): open while the money is held and the 48h window (if started) hasn't closed.
create or replace function public.raise_dispute(p_booking uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare d_id uuid;
begin
  perform set_config('lodgelock.transition_reason', 'student raised dispute', true);
  update public.bookings set status = 'DISPUTED', auto_release_at = null
   where id = p_booking and student_id = auth.uid() and status = 'PAID_HELD'
     and (auto_release_at is null or now() <= auto_release_at);
  if not found then raise exception 'booking not found, not disputable, or window closed'; end if;
  insert into public.disputes (booking_id, raised_by, reason)
    values (p_booking, auth.uid(), p_reason) returning id into d_id;
  return d_id;
end $$;

-- ─────────────────────────────────────────────────────────────── deadlines (cron)
drop function if exists public.run_auto_confirm();
drop function if exists private.auto_confirm_expired();

create function private.process_deadlines()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  released integer := 0;
  no_shows integer := 0;
  today date := (now() at time zone 'Africa/Lagos')::date;
begin
  perform set_config('lodgelock.transition_reason', 'no student response within 48h of handover', true);
  for r in
    select id from public.bookings
     where status = 'PAID_HELD' and handover_at is not null and student_confirmed_at is null
       and auto_release_at < now()
     for update skip locked
  loop
    update public.bookings set status = 'AUTO_CONFIRMED' where id = r.id;
    perform private.book_release(r.id);
    released := released + 1;
  end loop;

  perform set_config('lodgelock.transition_reason', 'no-show: not confirmed by move-in date + 7 days', true);
  for r in
    select id from public.bookings
     where status = 'PAID_HELD' and handover_at is null and student_confirmed_at is null
       and move_in_date + 7 < today
     for update skip locked
  loop
    update public.bookings set status = 'STUDENT_CANCELLED', cancellation_kind = 'no_show', cancelled_at = now()
     where id = r.id;
    perform private.book_cancellation(r.id);
    no_shows := no_shows + 1;
  end loop;
  return jsonb_build_object('auto_released', released, 'no_shows', no_shows);
end $$;
revoke execute on function private.process_deadlines() from public, anon, authenticated;

create function public.run_booking_deadlines()
returns jsonb language sql security definer set search_path = ''
as $$ select private.process_deadlines() $$;

-- ─────────────────────────────────────────────────────────────── grants
revoke execute on function public.run_booking_deadlines() from public, anon, authenticated;
grant execute on function public.run_booking_deadlines() to service_role;
revoke execute on function public.create_booking(uuid, date, uuid), public.mark_handover(uuid),
  public.confirm_move_in(uuid), public.cancel_booking(uuid), public.sign_payee_mandate(uuid, uuid, text),
  public.revoke_payee_mandate(uuid), public.set_lodge_caretaker(uuid, text) from public, anon;
grant execute on function public.create_booking(uuid, date, uuid), public.mark_handover(uuid),
  public.confirm_move_in(uuid), public.cancel_booking(uuid), public.sign_payee_mandate(uuid, uuid, text),
  public.revoke_payee_mandate(uuid), public.set_lodge_caretaker(uuid, text) to authenticated;
