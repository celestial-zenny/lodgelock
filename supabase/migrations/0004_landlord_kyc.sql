-- 0004: landlord/agent KYC (Interswitch API Marketplace) + admin approval queue.
-- Flow: kyc_grant_consent (user) -> server runs NIN -> BVN Boolean Match -> bank account checks
--       -> record_kyc_submission (service role) writes pass/fail rows + a pending review
--       -> admin decides via decide_kyc_review, which sets profiles.identity_verified_at.
-- Raw NIN/BVN/account numbers never reach the database.

-- ─────────────────────────────────────────────────────────────── consent
-- One call records the three purpose-specific consents shown on the consent screen.
-- Rate-limited here so the KYC endpoint (which spends paid provider calls) can't be hammered.
create function public.kyc_grant_consent(p_policy_version text)
returns table (nin_consent uuid, bvn_consent uuid, bank_consent uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p   public.profiles;
  c1 uuid; c2 uuid; c3 uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform private.hit_rate_limit('kyc:' || uid, 5, 86400);

  select * into p from public.profiles where id = uid;
  if p.id is null or p.role not in ('landlord', 'agent') then
    raise exception 'only landlords and agents are verified';
  end if;
  if not p.is_adult then raise exception 'must be 18 or over'; end if;
  if p.identity_verified_at is not null then raise exception 'already verified'; end if;
  if exists (select 1 from public.kyc_reviews r where r.subject_id = uid and r.status = 'pending') then
    raise exception 'review already pending';
  end if;
  if p_policy_version is null or char_length(p_policy_version) > 32 then
    raise exception 'invalid policy version';
  end if;

  insert into public.consents (user_id, purpose, policy_version) values (uid, 'kyc_nin', p_policy_version)  returning id into c1;
  insert into public.consents (user_id, purpose, policy_version) values (uid, 'kyc_bvn', p_policy_version)  returning id into c2;
  insert into public.consents (user_id, purpose, policy_version) values (uid, 'kyc_bank', p_policy_version) returning id into c3;
  return query select c1, c2, c3;
end $$;

-- ─────────────────────────────────────────────────────────────── review queue
create type public.kyc_review_status as enum ('pending', 'approved', 'rejected');

create table public.kyc_reviews (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.profiles (id) on delete cascade,
  nin_passed    boolean,            -- null = check not run (an earlier check failed)
  bvn_passed    boolean,
  bank_passed   boolean,
  all_passed    boolean generated always as (coalesce(nin_passed and bvn_passed and bank_passed, false)) stored,
  status        public.kyc_review_status not null default 'pending',
  submitted_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles (id),
  admin_note    text check (admin_note is null or char_length(admin_note) <= 500)
);
create unique index kyc_reviews_one_pending on public.kyc_reviews (subject_id) where status = 'pending';
create index on public.kyc_reviews (status, submitted_at);
alter table public.kyc_reviews enable row level security;
create policy kyc_reviews_read on public.kyc_reviews for select to authenticated
  using (subject_id = (select auth.uid()) or (select private.is_admin()));
-- No write policies: service role (submission) and decide_kyc_review (admin) only.

-- Called ONLY by the server (service role) after the Interswitch calls. Checks that each result
-- is backed by a live consent of the right purpose belonging to the subject.
create function public.record_kyc_submission(
  p_subject uuid,
  p_nin_passed boolean, p_bvn_passed boolean, p_bank_passed boolean,
  p_nin_consent uuid, p_bvn_consent uuid, p_bank_consent uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  r_id uuid;
  checks constant text[] := array['nin', 'bvn_match', 'bank_account'];
  purposes constant text[] := array['kyc_nin', 'kyc_bvn', 'kyc_bank'];
  results boolean[] := array[p_nin_passed, p_bvn_passed, p_bank_passed];
  consents uuid[] := array[p_nin_consent, p_bvn_consent, p_bank_consent];
begin
  if p_nin_passed is null then raise exception 'NIN result required'; end if;
  for i in 1..3 loop
    continue when results[i] is null;
    if not exists (select 1 from public.consents c where c.id = consents[i] and c.user_id = p_subject
                   and c.purpose = purposes[i] and c.withdrawn_at is null) then
      raise exception 'no valid consent for %', checks[i];
    end if;
    insert into public.kyc_verifications (subject_id, check_type, passed, consent_id)
    values (p_subject, checks[i]::public.kyc_check, results[i], consents[i]);
  end loop;

  insert into public.kyc_reviews (subject_id, nin_passed, bvn_passed, bank_passed)
  values (p_subject, p_nin_passed, p_bvn_passed, p_bank_passed)
  returning id into r_id;
  return r_id;
end $$;
revoke execute on function public.record_kyc_submission(uuid, boolean, boolean, boolean, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.record_kyc_submission(uuid, boolean, boolean, boolean, uuid, uuid, uuid)
  to service_role;

-- Admin approves/rejects. Approval requires all three checks passed.
create function public.decide_kyc_review(p_review uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  r public.kyc_reviews;
begin
  if not private.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into r from public.kyc_reviews where id = p_review for update;
  if r.id is null then raise exception 'review not found'; end if;
  if r.status <> 'pending' then raise exception 'review already decided'; end if;
  if p_approve and not r.all_passed then raise exception 'cannot approve: not all checks passed'; end if;

  update public.kyc_reviews
     set status = case when p_approve then 'approved' else 'rejected' end::public.kyc_review_status,
         decided_at = now(), decided_by = auth.uid(), admin_note = nullif(trim(p_note), '')
   where id = r.id;
  if p_approve then
    update public.profiles set identity_verified_at = now() where id = r.subject_id;
  end if;
end $$;

revoke execute on function public.kyc_grant_consent(text) from public, anon;
grant execute on function public.kyc_grant_consent(text) to authenticated;
revoke execute on function public.decide_kyc_review(uuid, boolean, text) from public, anon;
grant execute on function public.decide_kyc_review(uuid, boolean, text) to authenticated;

-- Rate limit for the submit step (each submit spends up to three provider calls).
-- Called by the server action as the user, before any Interswitch request.
create function public.kyc_begin_check()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform private.hit_rate_limit('kyc_submit:' || auth.uid(), 5, 86400);
end $$;
revoke execute on function public.kyc_begin_check() from public, anon;
grant execute on function public.kyc_begin_check() to authenticated;
