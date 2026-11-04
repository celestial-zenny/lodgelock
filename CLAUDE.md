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
PAID_HELD -> (72h no response) -> AUTO_CONFIRMED -> PAID_OUT
DRAFT -> CANCELLED (abandoned / cancelled before payment)
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
