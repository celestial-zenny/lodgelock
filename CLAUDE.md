@AGENTS.md

# LodgeLock

## What it is
LodgeLock is a verified lodge-booking app for FUTO (Federal University of Technology, Owerri) students.
Core promise: rent is held and only released to the landlord AFTER the student moves in and confirms
the lodge matches the listing. Landlords and agents are identity-verified. Agent fees are capped
and shown upfront (cap: 5% of annual rent — `lodges.agent_fee_cap` + `src/lib/booking/money.ts`).

Built for the Beyond Access hackathon (HacktoberXFUTO). Proposal due Nov 19 2026; working prototype for finals.

## Users
- Student: browse verified lodges, book, pay, confirm move-in, raise dispute, review
- Landlord / verified agent: get verified, list lodge, receive payout after move-in
- Scout (paid student): inspect lodge, upload photos + checklist
- Admin: approve verifications, resolve disputes

## Stack
- Next.js (App Router, TypeScript, Tailwind) on Vercel
- Supabase: Postgres, Auth, Storage (lodge photos), Row Level Security ON for every table
- Interswitch SANDBOX ONLY (developer.interswitchgroup.com):
  - Web Checkout: student pays rent
  - Transfer Service + bank confirmation: payout to landlord
  - Refunds: failed/disputed move-in
  - KYC: NIN, BVN Boolean Match, Bank Account Verification for landlords/agents
  - Bills Payment (stretch): pay lodge electricity
- Fallback if an Interswitch sandbox endpoint blocks us: Paystack test mode

## Booking state machine
Full rules, money table and tests: `docs/booking-state-machine.md`.
DRAFT -> PAID_HELD -> (student confirms) MOVE_IN_CONFIRMED -> PAID_OUT
PAID_HELD -> (handover marked, student silent 48h) -> AUTO_CONFIRMED -> PAID_OUT
PAID_HELD -> DISPUTED -> (REFUNDED | PAID_OUT)
PAID_HELD -> STUDENT_CANCELLED (student cancels, or no-show 7 days after move-in date with no handover)
DRAFT -> CANCELLED (abandoned / cancelled before payment)

## Release rule and money (migration 0007)
- Bookings carry `move_in_date`. No clock starts at payment.
- Landlord, agent or caretaker marks "keys handed over" (`mark_handover` -> `handover_at`, `auto_release_at` = +48h).
  Payout is released when the student confirms (`confirm_move_in`), or automatically 48h after handover with no
  student response. Disputes are allowed until `auto_release_at`.
- No-show: no handover and no student confirmation by `move_in_date` + 7 days -> STUDENT_CANCELLED (`no_show`).
- Student cancellation (`cancel_booking`, no landlord fault): free within 24h of payment and before handover; otherwise
  (and for no-shows) the landlord receives 10% of rent minus any commitment fee already paid; the rest is refunded.
- One payment, split at release: rent (minus commitment fee and landlord-paid commission) -> landlord; agent fee
  (student-paid, <= 5%) + landlord-paid commission (`lodges.landlord_commission_pct`, default 5%, 0-10%) -> agent.
- Rent NEVER goes to an agent unless the landlord signed an active payee mandate (`sign_payee_mandate`) naming the
  booking's KYC-verified agent. Payouts to unverified landlords/agents are recorded as `awaiting_kyc`.
- Renewal (`create_booking(..., p_renewal_of)` after a completed tenancy): no student agent fee; the linked agent earns
  2.5% of the new rent, deducted from the landlord's share.
- Optional commitment fee per lodge (`lodges.commitment_fee_pct`: 0 or 10-20%), paid to the rent payee at payment,
  never held. Always shown before payment.
- Caretaker role: assigned per lodge by the landlord (`set_lodge_caretaker`), can see the lodge's bookings and mark
  handover, and is NEVER a payee (`private.instruct` refuses).
- Every money movement = one balanced ledger txn + one `payout_instructions` row per payee. Transfers (PAID_OUT) and
  dispute resolution are not built yet.
- Tests: `npm test` (TS mirror) and `npm run test:db` (all migrations + `supabase/tests/money_paths.sql` on a local
  Postgres). Add a case there for any new money path; the ledger must balance.
Every transition is written to an append-only booking_events table.
Source of truth: the DB (`booking_transitions` table + `private.bookings_guard`, migrations 0001/0005/0007).
`src/lib/booking/state-machine.ts` and `src/lib/booking/money.ts` mirror it for the UI — keep them in sync.

## Money rules
- LodgeLock NEVER holds funds itself. Money is collected by Interswitch and held/released via a
  licensed partner. Our DB only records state and instructions.
- All amounts are integer kobo (`bigint`), never floats.
- Use a double-entry style ledger table; webhooks must be idempotent (dedupe on transaction ref).
- Always re-verify payment status server-side (never trust the client).

## Security (non-negotiable)
- Secrets only in .env.local / Vercel env vars, never committed (`.env.example` lists names only)
- RLS on every Supabase table; students only see their own bookings
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (`import "server-only"`); never in a `NEXT_PUBLIC_` var
- Verify Interswitch webhook signatures
- Rate-limit auth, booking and KYC endpoints
- Never log or store raw BVN/NIN; store only verification result + timestamp

## NDPA 2023 compliance (build in by default)
- 18+ age gate at signup; under-18 path requires parent/guardian consent
- Explicit consent screen BEFORE any NIN/BVN/bank check, stating purpose
- Document lawful basis for each data processing activity in /docs/data-processing.md
- Self-host fonts (next/font/local, files in src/app/fonts), NO fonts.googleapis.com / next/font/google
- No analytics / session replay until user opts in
- Any marketing email/SMS: sender identity + working unsubscribe
- Privacy policy page + data deletion request flow

## Conventions
- Mobile-first UI (students are on phones)
- Server actions / route handlers for all writes
- Zod validation on every input
- No AI/Claude attribution in commits or PR descriptions

## Working notes
- Supabase project: `lodgelock` (ref `vnwqvokhybdvrlldnnrb`, eu-west-2). Migrations in `supabase/migrations/`
  are applied in order; demo data in `supabase/seed.sql` (idempotent upsert, lodges flagged `is_demo`, prices
  illustrative: self-con ₦250k-₦350k, single ₦150k-₦220k, room-and-parlour ₦400k-₦500k, all 5% agent fee).
  Enum values must be added in their own migration (0006) before a migration uses them.
- After any migration, regenerate `src/lib/supabase/database.types.ts` and re-run the security advisor.
- Helper/trigger functions live in the non-exposed `private` schema. Only intentional RPCs stay in `public`
  (`create_booking`, `begin_payment`, `confirm_move_in`, `mark_handover`, `cancel_booking`, `raise_dispute`,
  `sign_payee_mandate`, `revoke_payee_mandate`, `set_lodge_caretaker`, `lodge_trust`, `kyc_grant_consent`,
  `kyc_begin_check`, `decide_kyc_review`; service-role only: `record_payment`, `record_kyc_submission`,
  `run_booking_deadlines`).
- Profiles are created only by the `on_auth_user_created` trigger from sign-up metadata (roles: student, landlord,
  agent, caretaker; scout/admin are set by an admin). DOB is never stored.
- Next 16 + `cacheComponents`: anything reading cookies/params/searchParams must render inside `<Suspense>`;
  session refresh lives in `src/proxy.ts` (middleware was renamed to proxy). Run `npx next typegen` for `PageProps`.
  `createUserClient()` calls `await io()` after `cookies()`: supabase-js reads `Date.now()` for session expiry, and with
  Partial Prefetching cookies can resolve during a runtime prerender ("Blocking Route: Date.now()"). Keep it.
  Don't read the clock in Client Components during render either (e.g. no computed `min` on date inputs).
- Payments (Interswitch Web Checkout, sandbox): `create_booking` RPC -> `begin_payment` RPC (new `LL-…` txn_ref per
  attempt, server-set amount) -> inline checkout -> `settlePayment()` requeries Interswitch -> `record_payment` RPC
  (service role only; idempotent; DRAFT -> PAID_HELD + balanced ledger; commitment fee instructed to the rent payee,
  the rest held in `held:booking:<id>`). The webhook only triggers a requery. Release/cancellation go through
  `private.book_release` / `private.book_cancellation` -> `private.instruct` (ledger credit + payout instruction).
  Interswitch config refuses non-TEST mode and non-sandbox hosts (`src/lib/interswitch/config.ts`).
- KYC (Interswitch API Marketplace, sandbox): `src/lib/interswitch/marketplace.ts` (server-only; client-credentials token
  cached until expiry; returns pass/fail only). `/verify`: consent screen -> `kyc_grant_consent` RPC -> `kyc_begin_check`
  (rate limit) -> NIN -> BVN Boolean Match -> bank account -> `record_kyc_submission` (service role only) -> `kyc_reviews`
  queue -> admin `/admin/kyc` -> `decide_kyc_review` sets `profiles.identity_verified_at`. Marketplace URLs/paths are
  env-overridable; non-sandbox hosts are refused.
- Rate limits are enforced inside DB functions via `private.hit_rate_limit` (create_booking, begin_payment: 10/hour/user).
