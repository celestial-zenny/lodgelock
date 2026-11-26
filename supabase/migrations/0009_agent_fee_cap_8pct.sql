-- Agent fee cap: raise the student-paid agent fee limit from 5% to 8% of annual rent.
-- Replaces lodges.agent_fee_cap from 0001_init.sql (which is applied and must not be edited).
-- Keep in sync with AGENT_FEE_CAP_BPS in src/lib/booking/money.ts.
--
-- Raising a cap only loosens the check, so every existing row still satisfies it.
-- Bookings snapshot the lodge's fee at creation (bookings_guard), so existing bookings are unaffected.

alter table public.lodges
  drop constraint agent_fee_cap,
  add constraint agent_fee_cap check (agent_fee_kobo * 100 <= rent_kobo * 8);
