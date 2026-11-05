# Booking state machine and money rules

Source of truth: the database. `public.booking_transitions` lists legal moves and `private.bookings_guard` enforces
them plus the release conditions below (migrations `0001`, `0005`, `0007`). `src/lib/booking/state-machine.ts` and
`src/lib/booking/money.ts` mirror them for the UI. Change all three together, and run `npm test` and `npm run test:db`.

## States

```
DRAFT ──pay──▶ PAID_HELD ──student confirms move-in──────────────▶ MOVE_IN_CONFIRMED ──transfer──▶ PAID_OUT
  │                │ ──handover marked + 48h, no student response──▶ AUTO_CONFIRMED ──transfer──▶ PAID_OUT
  │                │ ──student disputes (landlord fault)──────────▶ DISPUTED ──admin──▶ REFUNDED | PAID_OUT
  │                │ ──student cancels / no-show (student fault)──▶ STUDENT_CANCELLED (refund booked)
  └──abandoned──▶ CANCELLED
```

| Event | Who | Rule |
|---|---|---|
| Book | student | `create_booking(lodge, move_in_date, renewal_of?)`. Move-in date: today .. +400 days (Lagos). Terms are snapshotted and immutable. |
| Pay | Interswitch → server | `record_payment` (service role, after requery). Commitment fee (if any) is paid to the rent payee now; the rest is held. No clock starts at payment. |
| Handover | landlord, agent or caretaker | `mark_handover`. Sets `handover_at`, `auto_release_at = handover_at + 48h`. Final. |
| Confirm move-in | student | `confirm_move_in`. Releases immediately. |
| Auto-release | cron | `handover_at` set, no student response, `auto_release_at` passed → `AUTO_CONFIRMED`, released. |
| Dispute | student | `raise_dispute` while held and before `auto_release_at` (if set). Money stays held; nothing auto-releases. |
| Cancel | student | `cancel_booking` while held. **grace**: within 24h of payment and before handover. Otherwise **late**. |
| No-show | cron | No handover and no confirmation by `move_in_date + 7 days` → `STUDENT_CANCELLED` (`no_show`). |

The cron is `/api/cron/booking-deadlines` (daily on Vercel Hobby, so deadlines can run up to a day late).

## Money (integer kobo, rounded down)

Snapshotted on the booking at creation:

- `rent_kobo`: lodge rent.
- `agent_fee_kobo`: student-paid, ≤ 5% of rent. 0 if the lodge has no agent, and 0 on renewals.
- `agent_commission_kobo`: landlord-paid, deducted from the landlord's rent. The lodge's `landlord_commission_pct`
  (default 5%, 0–10%), or 2.5% of rent on a renewal (renewal bonus to the original booking's agent).
- `commitment_fee_kobo`: optional, 10–20% of rent, paid to the rent payee at payment.

Student pays `rent + agent_fee`. Held after payment: `rent − commitment + agent_fee`.

| Path | Held amount goes to |
|---|---|
| Release (confirm or auto) | rent payee: `rent − commitment − agent_commission`; agent: `agent_fee + agent_commission` |
| Grace cancellation | student refund: everything held (the commitment fee stays with the landlord) |
| Late cancellation / no-show | landlord: `max(0, 10% of rent − commitment)`; student refund: the rest |
| Dispute | stays held until an admin resolves it (resolution flow not built yet) |

**Rent payee** is the landlord, unless the landlord has signed an active **payee mandate** naming the booking's
KYC-verified agent (`sign_payee_mandate`). Only then does rent go to the agent.

Every movement is one balanced ledger transaction (`ledger_entries`; `held:booking:<id>` → `landlord:<id>`,
`agent:<id>`, `student:<id>`) plus one `payout_instructions` row per payee credit. Instructions to a landlord or agent
without KYC are `awaiting_kyc`. **Caretakers are never payees**: `private.instruct` refuses them.

The actual transfers (`PAID_OUT`, refunds through the payment partner) are not built yet. `payout_instructions` is what
that step will execute.

## Tests

- `npm run test:db` (`scripts/test-db.sh`): applies every migration to a throwaway local Postgres database and runs
  `supabase/tests/money_paths.sql`. That suite covers every path above and checks after each one that every ledger
  txn balances, escrow = paid out + held, every instruction has its ledger credit, and no caretaker is a payee.
- `npm test`: the TypeScript mirror (`src/lib/booking/money.test.ts`), including rounding sweeps that check no kobo
  is created or lost.
