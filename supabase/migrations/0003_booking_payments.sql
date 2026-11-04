-- 0003: booking creation, payment attempts (Interswitch Web Checkout), payment recording,
-- DB-enforced rate limits, and data-deletion request guard.

-- ─────────────────────────────────────────────────────────────── rate limiting
-- Fixed-window counter. Enforced inside the DB functions so it can't be bypassed via the API.
create table private.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
alter table private.rate_limits enable row level security;  -- no policies: definer functions only

create function private.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if n > p_limit then
    raise exception 'rate limit exceeded' using errcode = 'P0429';
  end if;
  -- opportunistic cleanup
  delete from private.rate_limits where window_start < now() - interval '1 day';
end $$;
revoke execute on function private.hit_rate_limit(text, integer, integer) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────── bookings
-- All booking creation goes through create_booking (rate-limited, eligibility-checked).
drop policy bookings_create on public.bookings;

create function public.create_booking(p_lodge uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  p    public.profiles;
  b_id uuid;
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

  -- Reuse an unpaid booking for the same lodge instead of piling up drafts.
  select id into b_id from public.bookings
   where student_id = uid and lodge_id = p_lodge and status = 'DRAFT'
   order by created_at desc limit 1;
  if b_id is not null then return b_id; end if;

  -- Price/status are set by private.bookings_guard from the lodge row, never from the caller.
  insert into public.bookings (student_id, lodge_id, rent_kobo, agent_fee_kobo)
  values (uid, p_lodge, 0, 0) returning id into b_id;
  return b_id;
end $$;
revoke execute on function public.create_booking(uuid) from public, anon;
grant execute on function public.create_booking(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────── payment attempts
-- One row per checkout launch. txn_ref is our unique merchant reference sent to Interswitch.
create table public.payment_attempts (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings (id),
  txn_ref               text not null unique,
  amount_kobo           bigint not null check (amount_kobo > 0),
  provider              text not null default 'interswitch',
  status                text not null default 'pending'
                          check (status in ('pending', 'succeeded', 'failed', 'needs_refund')),
  provider_payment_ref  text,          -- Interswitch PaymentReference from requery
  last_response_code    text,
  created_at            timestamptz not null default now(),
  settled_at            timestamptz
);
create index on public.payment_attempts (booking_id);
alter table public.payment_attempts enable row level security;
create policy attempts_read on public.payment_attempts for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id)); -- inherits bookings RLS

-- Student starts a checkout: returns a fresh txn_ref and the server-side amount.
create function public.begin_payment(p_booking uuid)
returns table (txn_ref text, amount_kobo bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  b   public.bookings;
  ref text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform private.hit_rate_limit('begin_payment:' || uid, 10, 3600);

  select * into b from public.bookings where id = p_booking and student_id = uid for update;
  if b.id is null then raise exception 'booking not found'; end if;
  if b.status <> 'DRAFT' then raise exception 'booking is not awaiting payment'; end if;

  ref := 'LL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  insert into public.payment_attempts (booking_id, txn_ref, amount_kobo)
  values (b.id, ref, b.rent_kobo + b.agent_fee_kobo);
  return query select ref, b.rent_kobo + b.agent_fee_kobo;
end $$;
revoke execute on function public.begin_payment(uuid) from public, anon;
grant execute on function public.begin_payment(uuid) to authenticated;

-- Called ONLY by the server (service role) after re-querying Interswitch.
-- Idempotent: safe to call from the browser callback, the redirect and the webhook for the same ref.
-- Returns one of: paid | already_paid | pending | amount_mismatch | duplicate_payment | unknown_ref
create function public.record_payment(
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
    -- Paid twice (e.g. two tabs). Booking already held; flag this attempt for refund.
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

  -- Funds now sit with the payment partner, owed to this booking until release or refund.
  insert into public.ledger_entries (txn_id, booking_id, account, direction, amount_kobo, external_ref) values
    (txn, b.id, 'partner_escrow',          'debit',  a.amount_kobo, p_provider_ref),
    (txn, b.id, 'held:booking:' || b.id,   'credit', a.amount_kobo, p_provider_ref);
  return 'paid';
end $$;
revoke execute on function public.record_payment(text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_payment(text, text, bigint, text) to service_role;

-- ─────────────────────────────────────────────────────────────── NDPA deletion requests
create unique index data_deletion_one_pending on public.data_deletion_requests (user_id) where status = 'pending';
alter table public.data_deletion_requests
  add constraint deletion_reason_len check (reason is null or char_length(reason) <= 1000);
