# Data processing record (NDPA 2023)

> Draft for the hackathon prototype. Have it reviewed before any real launch.
> Lawful bases refer to NDPA 2023 s.25(1): (a) consent, (b) contract, (c) legal obligation,
> (d) vital interests, (e) public interest, (f) legitimate interests.

**Controller:** LodgeLock team (contact: _TBD — add a monitored privacy email before launch_)
**Data subjects:** students, landlords, agents, caretakers, scouts, admins.

| # | Activity | Data | Subjects | Lawful basis | Where stored | Retention |
|---|----------|------|----------|--------------|--------------|-----------|
| 1 | Account & sign-in | Name, email, phone, 18+ attestation | All | Contract (b) | Supabase Auth, `profiles` | Life of account + 30 days |
| 2 | Under-18 guardian consent | Guardian name, phone, relationship, consent and confirmation timestamps | Students under 18 and their guardians | Consent (a) of parent/guardian | `guardian_consents`, `profiles.guardian_consent_at` | Life of account |
| 3 | Identity verification (NIN) | NIN sent to Interswitch KYC; **only pass/fail + timestamp kept** | Landlords, agents | Consent (a), captured on a purpose screen before the check | `kyc_verifications`, `consents` | Result: life of account + 2 yrs (fraud defence) |
| 4 | BVN Boolean Match | BVN + name sent to Interswitch; **only pass/fail kept** | Landlords, agents | Consent (a) | `kyc_verifications`, `consents` | As #3 |
| 5 | Bank account verification for payouts | Account no. + bank code sent to Interswitch; name-match result kept; payout instruction held by payment partner | Landlords, agents | Contract (b) + Consent (a) | Payment partner; result in `kyc_verifications` | As #3 |
| 6 | Rent payment & escrow record | Booking, amounts, provider transaction refs | Students, landlords | Contract (b); Legal obligation (c) for financial records | `bookings`, `ledger_entries`, `booking_events` | 6 years (financial records) |
| 6b | Payout split & instructions | Payee, kind (rent, agent fee, commission, renewal bonus, commitment fee, compensation, refund), amount, KYC status | Landlords, agents, students (refunds) | Contract (b); Legal obligation (c) for financial records | `payout_instructions`, `ledger_entries` | 6 years (financial records) |
| 6c | Payee mandate | Landlord, named agent, lodge, policy version, signed/revoked timestamps | Landlords, agents | Contract (b): the landlord's instruction to pay rent to their agent | `payee_mandates` | Life of mandate + 6 years |
| 6d | Handover & move-in confirmation | Who marked the handover, timestamps, move-in date, cancellation type | Students, landlords, agents, caretakers | Contract (b) | `bookings`, `booking_events` | 6 years (financial records) |
| 6a | Payment attempts | Our transaction ref, amount, provider reference, response code | Students | Contract (b); Legal obligation (c) | `payment_attempts` | 6 years (financial records) |
| 7 | Payment webhooks | Provider event payload (no BVN/NIN) | Students, landlords | Contract (b) | `webhook_events` | 1 year |
| 8 | Disputes | Dispute reason, evidence photos | Students, landlords | Contract (b); Legitimate interests (f) | `disputes`, Storage | 2 years after resolution |
| 9a | Caretaker assignment | Caretaker account linked to a lodge (looked up by the email the landlord enters) | Caretakers | Contract (b); Legitimate interests (f) of the landlord | `lodges.caretaker_id` | While assigned |
| 9 | Lodge listing & photos | Address, photos, price | Landlords/agents (and incidentally lodge) | Contract (b) | `lodges`, `lodge_photos`, Storage | While listed + 1 year |
| 10 | Scout inspections | Checklist, photos, scout identity | Scouts | Contract (b) | `inspections`, Storage | 2 years |
| 11 | Reviews | Rating, text, link to booking | Students | Legitimate interests (f) — honest information for other students | `reviews` | While lodge listed |
| 12 | Analytics | Usage events | Opted-in users only | Consent (a) — **off by default** | _Not implemented_ | — |
| 13 | Marketing email/SMS | Email/phone | Opted-in users only | Consent (a); every message names sender + working unsubscribe | _Not implemented_ | Until unsubscribe |
| 14 | Data deletion requests | Request record, optional reason | All | Legal obligation (c) | `data_deletion_requests` (submitted from /account) | 2 years |
| 5a | KYC admin review | Per-check pass/fail, submission and decision timestamps, deciding admin, optional note | Landlords, agents | Consent (a) for the checks; Legitimate interests (f) for fraud prevention review | `kyc_reviews` | As #3 |
| 15 | Abuse prevention (rate limits) | User id + action counter | Signed-in users | Legitimate interests (f) | `private.rate_limits` | 1 day |

## Processors / third parties
- **Supabase** — database, auth, file storage
- **Vercel** — hosting
- **Interswitch** — payments, payouts, refunds, KYC (sandbox during prototype)
- **Paystack** — fallback payments (test mode only)

## Safeguards
- Row Level Security on every table; students see only their own bookings.
- Raw NIN/BVN/account numbers are never stored or logged. They're passed straight to the provider in a server route, then discarded.
- Consent is recorded (`consents`) with purpose and policy version **before** any KYC call. It can be withdrawn.
- KYC flow (`/verify`): consent screen -> `kyc_grant_consent` records `kyc_nin`, `kyc_bvn`, `kyc_bank` consents -> server
  runs NIN, then BVN Boolean Match, then bank account checks, stopping at the first failure (data minimisation) ->
  `record_kyc_submission` (service role) refuses any result without a matching live consent. An admin approves at
  `/admin/kyc`; approval needs all three checks passed.
- `booking_events` and `ledger_entries` are append-only.
- Fonts are self-hosted, and no third-party trackers load before opt-in.

## Data subject rights
Users can request access, correction, or deletion in-app (`data_deletion_requests`). Records under a legal retention duty (#6) are kept and anonymised where possible, and the user is told this.
