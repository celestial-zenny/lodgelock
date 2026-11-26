# LodgeLock: status & handoff (Nov 26 2026, finals Saturday)

## Live
- Site: https://lodgelock-nine.vercel.app (Vercel, auto-deploys from `main`)
- Supabase project `lodgelock` (ref `vnwqvokhybdvrlldnnrb`, eu-west-2). Migrations 0001–0008 applied; seed run.
  **Apply `0009_agent_fee_cap_8pct.sql` (agent fee cap 5% → 8%) when merging the redesign, then re-run `seed.sql`**
  so the demo lodges show 8% agent fees. Until 0009 is applied the database still rejects fees above 5%.
- Admin: the team lead's account (role `admin`) → `/account` shows Identity approvals + Lodge approvals.
  Make another admin: `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '…');`
- Supabase Auth: **Confirm email is OFF** for the demo (sign-up logs you straight in). Turn it back on, with a
  custom SMTP sender (e.g. Resend), before real users.
- Vercel env set: Supabase URL / publishable key / service-role key, `NEXT_PUBLIC_SITE_URL`,
  `INTERSWITCH_MODE=TEST`, `INTERSWITCH_MERCHANT_CODE=MX6072`, `INTERSWITCH_PAY_ITEM_ID=9405967`.

## Verified working on the live site
- Sign-up (student → /lodges, landlord/agent → /verify), login, account page.
- Lodge browse/detail with the 8 demo lodges.
- Booking → Pay → **Interswitch sandbox checkout opens with the correct amount**.
- Server-side payment check (Passport token + `gettransaction`) verified against the live sandbox.

## Not yet verified (do first)
1. **Finish one sandbox payment by hand.** Log in as a student, book a lodge, Pay. In the Interswitch window switch
   to the **card** option (it may open on "Pay on Credit") and use Verve `5060990580000217499`, exp `03/50`,
   CVV `111`, PIN `1111`. Back on the booking page, press "I've paid. Check payment status" if it doesn't update.
   Expected: booking shows "Paid — rent held". Check in SQL: `select status from bookings order by created_at desc limit 1;`
   and the two balanced `ledger_entries` rows for it. If it stays unpaid, check Vercel Logs for `[db]` / `requery` lines.
2. Handover → confirm move-in → payout instructions (landlord side) end to end.
3. Listing flow: verified landlord lists a lodge with photos → approve at `/admin/lodges` → visible on /lodges.

## Known gaps
- Webhooks: can't be configured for the shared sandbox merchant MX6072; payments confirm via requery (works without).
- Payouts (Interswitch Transfer) and refunds: instructions are recorded in the ledger; no transfer is sent yet.
- Guardian confirmation for under-18s not built (minors can sign up but can't book).
- No "Forgot password" (needs working email). Reset by SQL:
  `update auth.users set encrypted_password = extensions.crypt('NEW', extensions.gen_salt('bf')) where email = '…';`
- Listing UI: `/landlord/listings` (status chips: Live / In review / Needs changes) and `/landlord/listings/new`
  (details, then photos). Editing an existing listing has no form yet (`updateLodge` is ready).
- Clare's design copy fixes: done (48h auto-release, 10% late-cancel, "admin approves → live; scout visit adds a badge",
  "In review").
- Lint warning in `src/app/signup/signup-form.tsx` (aria-invalid on radio) — cosmetic.

## Clean-up before the demo
- Delete test accounts: `delete from auth.users where email like 'lodgelock.signup.test+%@example.com';`
  (one exists with an unpaid booking at the moment; delete it after the payment test).

## Pitch deck
Link shared in the team chat. 12 slides, placeholders still to fill: slide 3 numbers
(sourced), slide 8 business model choice, slide 11 pilot numbers, slide 10 demo link (use the live site),
slide 12 team names + ask, slide 2 student quote.

## Where things live
- DB rules (source of truth): `supabase/migrations/`; tests: `npm run test:db` (needs local Postgres),
  `npm test` (money math). Payments: `src/lib/interswitch/*`, `src/lib/payments/settle.ts`, `src/app/bookings/`.
- Listing: `supabase/migrations/0008_lodge_listing.sql`, `src/lib/listing.ts`, `src/app/landlord/lodges/actions.ts`.
- DB errors are logged with a likely fix by `src/lib/db-error.ts` (check Vercel → Logs).
