-- LodgeLock initial schema.
-- Principles:
--   * RLS ON for every table. No policy = no access for anon/authenticated.
--   * Money-moving transitions (payment, payout, refund) are only performed by the
--     service role from server code after re-verifying with Interswitch.
--   * Student-initiated transitions go through SECURITY DEFINER functions that check auth.uid().
--   * All amounts are integer kobo.
--   * No raw NIN/BVN/account numbers are ever stored.

-- ─────────────────────────────────────────────────────────────── enums
create type public.user_role as enum ('student', 'landlord', 'agent', 'scout', 'admin');

create type public.booking_status as enum (
  'DRAFT', 'PAID_HELD', 'MOVE_IN_CONFIRMED', 'DISPUTED',
  'AUTO_CONFIRMED', 'REFUNDED', 'PAID_OUT', 'CANCELLED'
);

create type public.lodge_status as enum ('draft', 'pending_review', 'verified', 'suspended');
create type public.kyc_check as enum ('nin', 'bvn_match', 'bank_account');
create type public.dispute_status as enum ('open', 'resolved_refund', 'resolved_payout');
create type public.inspection_status as enum ('assigned', 'submitted', 'approved', 'rejected');
create type public.ledger_direction as enum ('debit', 'credit');

-- ─────────────────────────────────────────────────────────────── profiles
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  role                  public.user_role not null default 'student',
  full_name             text not null check (char_length(full_name) between 2 and 120),
  phone                 text check (phone ~ '^\+?[0-9]{10,15}$'),
  -- NDPA age gate: we record the attestation, not the date of birth.
  is_adult              boolean not null,
  guardian_consent_at   timestamptz,
  identity_verified_at  timestamptz,           -- set by server after successful KYC
  created_at            timestamptz not null default now(),
  constraint minor_needs_guardian check (is_adult or guardian_consent_at is not null)
);

-- Helpers. SECURITY DEFINER so policies can call them without recursive RLS.
create function public.current_role_is(r public.user_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = r) $$;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.current_role_is('admin') $$;

-- Users may only edit harmless fields. Role/verification are set by server or admin.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────── consent + KYC
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  purpose         text not null,          -- e.g. 'kyc_nin', 'kyc_bvn', 'kyc_bank', 'analytics', 'marketing'
  policy_version  text not null,
  granted_at      timestamptz not null default now(),
  withdrawn_at    timestamptz
);
create index on public.consents (user_id, purpose);

-- Result-only. NEVER add columns for raw NIN/BVN/account numbers.
create table public.kyc_verifications (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.profiles (id) on delete cascade,
  check_type    public.kyc_check not null,
  passed        boolean not null,
  provider      text not null default 'interswitch',
  provider_ref  text,                    -- opaque reference from the provider, not the identifier
  consent_id    uuid not null references public.consents (id),
  verified_at   timestamptz not null default now()
);
create index on public.kyc_verifications (subject_id, check_type);

-- ─────────────────────────────────────────────────────────────── lodges
create table public.lodges (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id),
  agent_id        uuid references public.profiles (id),
  title           text not null check (char_length(title) between 3 and 120),
  description     text not null default '',
  area            text not null,           -- e.g. 'Eziobodo', 'Umuchima', 'Ihiagwa'
  address         text not null,
  rent_kobo       bigint not null check (rent_kobo > 0),
  agent_fee_kobo  bigint not null default 0 check (agent_fee_kobo >= 0),
  status          public.lodge_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Agent fee cap: at most 5% of annual rent. Change here AND in src/lib/booking/money.ts.
  constraint agent_fee_cap check (agent_fee_kobo * 20 <= rent_kobo)
);
create index on public.lodges (status, area);

-- Non-admins cannot change status; any edit by the owner to a verified listing
-- sends it back to review so the listing a student books is the one that was verified.
-- "Privileged" = not a client role. With PostgREST, current_user is the JWT role
-- (anon / authenticated / service_role); SECURITY INVOKER so current_user is meaningful.
create function public.is_privileged()
returns boolean language sql stable set search_path = ''
as $$ select current_user not in ('anon', 'authenticated') or public.is_admin() $$;

create function public.lodges_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if public.is_privileged() then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
  else
    new.status := case when old.status = 'verified' then 'pending_review' else old.status end;
    new.owner_id := old.owner_id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger lodges_guard before insert or update on public.lodges
  for each row execute function public.lodges_guard();

create table public.lodge_photos (
  id            uuid primary key default gen_random_uuid(),
  lodge_id      uuid not null references public.lodges (id) on delete cascade,
  storage_path  text not null,
  uploaded_by   uuid not null references public.profiles (id),
  created_at    timestamptz not null default now()
);

create table public.inspections (
  id            uuid primary key default gen_random_uuid(),
  lodge_id      uuid not null references public.lodges (id) on delete cascade,
  scout_id      uuid not null references public.profiles (id),
  status        public.inspection_status not null default 'assigned',
  checklist     jsonb not null default '{}'::jsonb,
  notes         text,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────── bookings
create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles (id),
  lodge_id         uuid not null references public.lodges (id),
  status           public.booking_status not null default 'DRAFT',
  -- Snapshot of price at booking time (copied from lodge by trigger, never from client).
  rent_kobo        bigint not null,
  agent_fee_kobo   bigint not null,
  total_kobo       bigint generated always as (rent_kobo + agent_fee_kobo) stored,
  payment_ref      text unique,            -- our merchant transaction ref sent to Interswitch
  paid_at          timestamptz,
  move_in_deadline timestamptz,            -- paid_at + 72h; auto-confirm after this
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.bookings (student_id);
create index on public.bookings (lodge_id);
create index on public.bookings (status, move_in_deadline);

create table public.booking_transitions (
  from_status public.booking_status not null,
  to_status   public.booking_status not null,
  primary key (from_status, to_status)
);
insert into public.booking_transitions values
  ('DRAFT', 'PAID_HELD'),
  ('DRAFT', 'CANCELLED'),
  ('PAID_HELD', 'MOVE_IN_CONFIRMED'),
  ('PAID_HELD', 'DISPUTED'),
  ('PAID_HELD', 'AUTO_CONFIRMED'),
  ('MOVE_IN_CONFIRMED', 'PAID_OUT'),
  ('AUTO_CONFIRMED', 'PAID_OUT'),
  ('DISPUTED', 'REFUNDED'),
  ('DISPUTED', 'PAID_OUT');

-- Append-only audit log.
create table public.booking_events (
  id           bigint generated always as identity primary key,
  -- Deferred: bookings_guard logs the DRAFT event in a BEFORE INSERT trigger.
  booking_id   uuid not null references public.bookings (id) deferrable initially deferred,
  from_status  public.booking_status,
  to_status    public.booking_status not null,
  actor_id     uuid,                     -- null = system / service role
  reason       text,
  created_at   timestamptz not null default now()
);
create index on public.booking_events (booking_id, id);

create function public.forbid_mutation()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception '% is append-only', tg_table_name; end $$;
create trigger booking_events_append_only before update or delete on public.booking_events
  for each row execute function public.forbid_mutation();
create trigger booking_events_no_truncate before truncate on public.booking_events
  for each statement execute function public.forbid_mutation();

create function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare l public.lodges;
begin
  if tg_op = 'INSERT' then
    select * into l from public.lodges where id = new.lodge_id;
    if l.id is null or l.status <> 'verified' then
      raise exception 'lodge is not bookable';
    end if;
    new.status         := 'DRAFT';
    new.rent_kobo      := l.rent_kobo;
    new.agent_fee_kobo := l.agent_fee_kobo;
    new.payment_ref    := null;
    new.paid_at        := null;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, reason)
      values (new.id, null, 'DRAFT', auth.uid(), 'created');
    return new;
  end if;

  -- Price and parties are immutable after creation.
  if new.student_id <> old.student_id or new.lodge_id <> old.lodge_id
     or new.rent_kobo <> old.rent_kobo or new.agent_fee_kobo <> old.agent_fee_kobo then
    raise exception 'booking parties and price are immutable';
  end if;

  if new.status is distinct from old.status then
    if not exists (select 1 from public.booking_transitions
                   where from_status = old.status and to_status = new.status) then
      raise exception 'illegal booking transition % -> %', old.status, new.status;
    end if;
    if new.status = 'PAID_HELD' then
      new.paid_at          := coalesce(new.paid_at, now());
      new.move_in_deadline := new.paid_at + interval '72 hours';
    end if;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, reason)
      values (new.id, old.status, new.status, auth.uid(),
              nullif(current_setting('lodgelock.transition_reason', true), ''));
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger bookings_guard before insert or update on public.bookings
  for each row execute function public.bookings_guard();

-- Student-initiated transitions.
create function public.confirm_move_in(p_booking uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('lodgelock.transition_reason', 'student confirmed move-in', true);
  update public.bookings set status = 'MOVE_IN_CONFIRMED'
   where id = p_booking and student_id = auth.uid() and status = 'PAID_HELD';
  if not found then raise exception 'booking not found or not awaiting move-in'; end if;
end $$;

create table public.disputes (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null unique references public.bookings (id),
  raised_by    uuid not null references public.profiles (id),
  reason       text not null check (char_length(reason) between 10 and 2000),
  status       public.dispute_status not null default 'open',
  resolution   text,
  resolved_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create function public.raise_dispute(p_booking uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare d_id uuid;
begin
  perform set_config('lodgelock.transition_reason', 'student raised dispute', true);
  update public.bookings set status = 'DISPUTED'
   where id = p_booking and student_id = auth.uid() and status = 'PAID_HELD'
     and now() <= move_in_deadline;
  if not found then raise exception 'booking not found, not disputable, or window closed'; end if;
  insert into public.disputes (booking_id, raised_by, reason)
    values (p_booking, auth.uid(), p_reason) returning id into d_id;
  return d_id;
end $$;

-- Called by a cron route (service role) — moves silent bookings to AUTO_CONFIRMED.
create function public.auto_confirm_expired()
returns integer language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  perform set_config('lodgelock.transition_reason', 'no response within 72h', true);
  update public.bookings set status = 'AUTO_CONFIRMED'
   where status = 'PAID_HELD' and move_in_deadline < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.auto_confirm_expired() from public, anon, authenticated;

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings (id),
  lodge_id    uuid not null references public.lodges (id),
  student_id  uuid not null references public.profiles (id),
  rating      smallint not null check (rating between 1 and 5),
  body        text check (char_length(body) <= 2000),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────── money records
-- We never hold funds; this ledger mirrors what the payment partner reports.
create table public.ledger_entries (
  id            bigint generated always as identity primary key,
  txn_id        uuid not null,              -- groups the lines of one balanced transaction
  booking_id    uuid references public.bookings (id),
  account       text not null,              -- e.g. 'partner_escrow', 'student:<id>', 'landlord:<id>', 'agent:<id>'
  direction     public.ledger_direction not null,
  amount_kobo   bigint not null check (amount_kobo > 0),
  external_ref  text,                       -- Interswitch transaction / transfer / refund ref
  created_at    timestamptz not null default now()
);
create index on public.ledger_entries (txn_id);
create index on public.ledger_entries (booking_id);

create function public.ledger_must_balance()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select coalesce(sum(case direction when 'debit' then amount_kobo else -amount_kobo end), 0)
        from public.ledger_entries where txn_id = new.txn_id) <> 0 then
    raise exception 'ledger txn % does not balance', new.txn_id;
  end if;
  return null;
end $$;
create constraint trigger ledger_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function public.ledger_must_balance();
create trigger ledger_append_only before update or delete on public.ledger_entries
  for each row execute function public.forbid_mutation();

-- Webhook idempotency: insert ... on conflict do nothing; process only if inserted.
create table public.webhook_events (
  id            bigint generated always as identity primary key,
  provider      text not null,
  event_ref     text not null,
  payload       jsonb not null,           -- must not contain raw BVN/NIN
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  unique (provider, event_ref)
);

-- ─────────────────────────────────────────────────────────────── NDPA
create table public.data_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  reason        text,
  status        text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  requested_at  timestamptz not null default now(),
  completed_at  timestamptz
);

-- ─────────────────────────────────────────────────────────────── RLS
alter table public.profiles               enable row level security;
alter table public.consents               enable row level security;
alter table public.kyc_verifications      enable row level security;
alter table public.lodges                 enable row level security;
alter table public.lodge_photos           enable row level security;
alter table public.inspections            enable row level security;
alter table public.bookings               enable row level security;
alter table public.booking_transitions    enable row level security;
alter table public.booking_events         enable row level security;
alter table public.disputes               enable row level security;
alter table public.reviews                enable row level security;
alter table public.ledger_entries         enable row level security;
alter table public.webhook_events         enable row level security;
alter table public.data_deletion_requests enable row level security;

-- profiles
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and role in ('student', 'landlord', 'agent') and identity_verified_at is null);
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- consents
create policy consents_own on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_grant on public.consents for insert to authenticated
  with check (user_id = auth.uid() and withdrawn_at is null);
create policy consents_withdraw on public.consents for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- kyc (writes by service role only)
create policy kyc_own on public.kyc_verifications for select to authenticated
  using (subject_id = auth.uid() or public.is_admin());

-- lodges
create policy lodges_public on public.lodges for select to anon, authenticated
  using (status = 'verified' or owner_id = auth.uid() or agent_id = auth.uid() or public.is_admin());
create policy lodges_create on public.lodges for insert to authenticated
  with check (owner_id = auth.uid()
              and (public.current_role_is('landlord') or public.current_role_is('agent')));
create policy lodges_edit on public.lodges for update to authenticated
  using (owner_id = auth.uid() or agent_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or agent_id = auth.uid() or public.is_admin());

-- lodge photos
create policy photos_read on public.lodge_photos for select to anon, authenticated
  using (exists (select 1 from public.lodges l where l.id = lodge_id)); -- inherits lodges RLS
create policy photos_upload on public.lodge_photos for insert to authenticated
  with check (uploaded_by = auth.uid() and (
    exists (select 1 from public.lodges l where l.id = lodge_id and (l.owner_id = auth.uid() or l.agent_id = auth.uid()))
    or exists (select 1 from public.inspections i where i.lodge_id = lodge_photos.lodge_id
               and i.scout_id = auth.uid() and i.status = 'assigned')));

-- inspections (assigned by admin/service role)
create policy inspections_read on public.inspections for select to authenticated
  using (scout_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.lodges l where l.id = lodge_id and l.owner_id = auth.uid()));
create policy inspections_submit on public.inspections for update to authenticated
  using (scout_id = auth.uid() and status = 'assigned')
  with check (scout_id = auth.uid() and status in ('assigned', 'submitted'));

-- bookings: students see their own; landlord/agent see bookings on their lodges.
create policy bookings_read on public.bookings for select to authenticated
  using (student_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.lodges l where l.id = lodge_id
                    and (l.owner_id = auth.uid() or l.agent_id = auth.uid())));
create policy bookings_create on public.bookings for insert to authenticated
  with check (student_id = auth.uid() and public.current_role_is('student'));
-- No update/delete policies: transitions happen via functions or service role.

create policy transitions_read on public.booking_transitions for select to anon, authenticated using (true);

create policy events_read on public.booking_events for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id)); -- inherits bookings RLS

create policy disputes_read on public.disputes for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

create policy reviews_read on public.reviews for select to anon, authenticated using (true);
create policy reviews_write on public.reviews for insert to authenticated
  with check (student_id = auth.uid() and exists (
    select 1 from public.bookings b where b.id = booking_id and b.student_id = auth.uid()
      and b.lodge_id = reviews.lodge_id
      and b.status in ('MOVE_IN_CONFIRMED', 'AUTO_CONFIRMED', 'PAID_OUT')));

create policy ledger_admin_read on public.ledger_entries for select to authenticated using (public.is_admin());
-- webhook_events: service role only (no policies).

create policy deletion_own on public.data_deletion_requests for select to authenticated using (user_id = auth.uid());
create policy deletion_request on public.data_deletion_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- Functions callable by signed-in users.
revoke execute on function public.confirm_move_in(uuid) from public, anon;
revoke execute on function public.raise_dispute(uuid, text) from public, anon;
grant execute on function public.confirm_move_in(uuid) to authenticated;
grant execute on function public.raise_dispute(uuid, text) to authenticated;
