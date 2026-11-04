-- 0002: hardening (advisor fixes), sign-up profile creation with NDPA age gate,
-- listing fields for browse/detail, and a public trust-badge function.

-- ─────────────────────────────────────────────────────────────── private schema
-- Helpers and trigger functions must not be callable via /rest/v1/rpc.
-- `private` is not in the API's exposed schemas; policies can still call into it.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

alter function public.current_role_is(public.user_role) set schema private;
alter function public.is_admin()                        set schema private;
alter function public.is_privileged()                   set schema private;
alter function public.lodges_guard()                    set schema private;
alter function public.bookings_guard()                  set schema private;
alter function public.forbid_mutation()                 set schema private;
alter function public.ledger_must_balance()             set schema private;
alter function public.auto_confirm_expired()            set schema private;

-- Bodies referenced public.* by name; repoint them.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select private.current_role_is('admin') $$;

create or replace function private.is_privileged()
returns boolean language sql stable set search_path = ''
as $$ select current_user not in ('anon', 'authenticated') or private.is_admin() $$;

create or replace function private.lodges_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
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

-- Trigger functions are never meant to be called directly.
revoke execute on function private.lodges_guard(), private.bookings_guard(),
  private.forbid_mutation(), private.ledger_must_balance(), private.auto_confirm_expired()
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────── listing fields
create type public.room_type as enum ('single_room', 'self_contain', 'room_and_parlour', 'flat');

alter table public.lodges
  add column room_type           public.room_type not null default 'self_contain',
  add column amenities           text[] not null default '{}',
  add column distance_to_gate_m  integer check (distance_to_gate_m between 0 and 20000),
  add column nearest_gate        text check (nearest_gate in ('main_gate', 'back_gate')),
  add column is_demo             boolean not null default false;  -- seed/sample data, shown with a badge

create index on public.lodges (status, room_type, rent_kobo);

-- ─────────────────────────────────────────────────────────────── sign-up
-- Profiles are created ONLY by this trigger (from validated sign-up metadata).
drop policy profiles_self_insert on public.profiles;

create table public.guardian_consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  guardian_name   text not null check (char_length(guardian_name) between 2 and 120),
  guardian_phone  text not null check (guardian_phone ~ '^\+?[0-9]{10,15}$'),
  relationship    text not null check (relationship in ('parent', 'legal_guardian')),
  attested_at     timestamptz not null default now(),
  -- Set when the guardian confirms via their own channel (OTP/call). Until then, minors cannot pay.
  confirmed_at    timestamptz
);
alter table public.guardian_consents enable row level security;
create policy guardian_own on public.guardian_consents for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

create function private.handle_new_user()
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
  if v_role not in ('student', 'landlord', 'agent') then
    raise exception 'role not allowed at sign-up';
  end if;
  if not v_adult and v_role <> 'student' then
    raise exception 'landlords and agents must be 18+';
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
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ─────────────────────────────────────────────────────────────── trust badges
-- Public, read-only facts that make a listing trustworthy, without exposing
-- profiles or inspections tables: first name only, verification flags, latest approved inspection.
create function public.lodge_trust(p_lodge_ids uuid[])
returns table (
  lodge_id        uuid,
  owner_first_name text,
  owner_role      public.user_role,
  owner_verified  boolean,
  agent_first_name text,
  agent_verified  boolean,
  inspected_at    timestamptz,
  checklist       jsonb
)
language sql stable security definer set search_path = ''
as $$
  select l.id,
         split_part(o.full_name, ' ', 1),
         o.role,
         o.identity_verified_at is not null,
         split_part(a.full_name, ' ', 1),
         case when a.id is null then null else a.identity_verified_at is not null end,
         i.submitted_at,
         i.checklist
    from public.lodges l
    join public.profiles o on o.id = l.owner_id
    left join public.profiles a on a.id = l.agent_id
    left join lateral (
      select submitted_at, checklist from public.inspections
       where inspections.lodge_id = l.id and status = 'approved'
       order by submitted_at desc nulls last limit 1
    ) i on true
   where l.id = any (p_lodge_ids) and l.status = 'verified'
   limit 100
$$;
grant execute on function public.lodge_trust(uuid[]) to anon, authenticated;
