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
DRAFT -> PAID_HELD -> MOVE_IN_CONFIRMED -> PAID_OUT
PAID_HELD -> DISPUTED -> (REFUNDED | PAID_OUT)
PAID_HELD -> (landlord confirmed handover, student silent 72h) -> AUTO_CONFIRMED -> PAID_OUT
DRAFT -> CANCELLED (abandoned / cancelled before payment)

## Release rule
- Payout is released when BOTH the student and the landlord/agent tap "Keys handed over" in the app
  (`confirm_keys_handover` RPC). The second confirmation moves PAID_HELD -> MOVE_IN_CONFIRMED and books the payout
  in the ledger immediately (same-day payout instruction). Confirmations are final.
- 72h auto-confirm is a FALLBACK only: it runs when the landlord has confirmed and the student has neither confirmed
  nor disputed within 72h of the landlord's confirmation (`move_in_deadline`). No landlord confirmation = no deadline.
  Triggered daily by `/api/cron/auto-confirm` (`CRON_SECRET`, `vercel.json`).
- Optional commitment fee per lodge (`lodges.commitment_fee_pct`: 0 = off, else 10-20% of rent; snapshotted to
  `bookings.commitment_fee_kobo`). Released to the landlord at payment, NOT held, so not refundable through the hold.
  Always shown to the student before they pay. Helpers in `src/lib/booking/money.ts`.
Every transition is written to an append-only booking_events table.
Source of truth: `supabase/migrations/0001_init.sql` (`booking_transitions` table + trigger).
`src/lib/booking/state-machine.ts` mirrors it for the UI — keep the two in sync.

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
  are applied in order; demo data in `supabase/seed.sql` (idempotent, lodges flagged `is_demo`).
- After any migration, regenerate `src/lib/supabase/database.types.ts` and re-run the security advisor.
- Helper/trigger functions live in the non-exposed `private` schema. Only intentional RPCs stay in `public`
  (`confirm_keys_handover`, `raise_dispute`, `lodge_trust`, `create_booking`, `begin_payment`, `kyc_grant_consent`,
  `kyc_begin_check`, `decide_kyc_review`; service-role only: `record_payment`, `record_kyc_submission`, `run_auto_confirm`).
- Profiles are created only by the `on_auth_user_created` trigger from sign-up metadata. DOB is never stored.
- Next 16 + `cacheComponents`: anything reading cookies/params/searchParams must render inside `<Suspense>`;
  session refresh lives in `src/proxy.ts` (middleware was renamed to proxy). Run `npx next typegen` for `PageProps`.
  `createUserClient()` calls `await io()` after `cookies()`: supabase-js reads `Date.now()` for session expiry, and with
  Partial Prefetching cookies can resolve during a runtime prerender ("Blocking Route: Date.now()"). Keep it.
- Payments (Interswitch Web Checkout, sandbox): `create_booking` RPC -> `begin_payment` RPC (new `LL-…` txn_ref per
  attempt, server-set amount) -> inline checkout -> `settlePayment()` requeries Interswitch -> `record_payment` RPC
  (service role only; idempotent; DRAFT -> PAID_HELD + balanced ledger; commitment fee credited to `landlord:<id>`,
  the rest to `held:booking:<id>`). The webhook only triggers a requery. On release, `private.book_release` moves the
  held amount to `landlord:<id>` / `agent:<id>`; the actual transfer (PAID_OUT) is not built yet.
  Interswitch config refuses non-TEST mode and non-sandbox hosts (`src/lib/interswitch/config.ts`).
- KYC (Interswitch API Marketplace, sandbox): `src/lib/interswitch/marketplace.ts` (server-only; client-credentials token
  cached until expiry; returns pass/fail only). `/verify`: consent screen -> `kyc_grant_consent` RPC -> `kyc_begin_check`
  (rate limit) -> NIN -> BVN Boolean Match -> bank account -> `record_kyc_submission` (service role only) -> `kyc_reviews`
  queue -> admin `/admin/kyc` -> `decide_kyc_review` sets `profiles.identity_verified_at`. Marketplace URLs/paths are
  env-overridable; non-sandbox hosts are refused.
- Rate limits are enforced inside DB functions via `private.hit_rate_limit` (create_booking, begin_payment: 10/hour/user).
