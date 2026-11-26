# Listing a lodge: backend contract for the frontend

What the "List your lodge" screens can call. The database enforces every rule; the actions below validate with
Zod first so the form can show field errors.

## Flow

1. Landlord/agent passes identity checks (`/verify`) and an admin approves them.
2. **Create**: `createLodge` → the lodge goes straight to admin review (`pending_review`). Returns `lodgeId`.
3. **Photos**: for each file, `uploadLodgePhoto(lodgeId, file)`. Up to 10, JPG/PNG/WebP, 5 MB each.
4. **Admin approves** at `/admin/lodges` → the lodge is live (`verified`). Or rejects with a reason
   (`review_note`) → back to `draft`; the lister fixes it and calls `submitLodge`.
5. A **scout inspection is a bonus badge**, never required to go live.

Editing a live lodge (details or photos) sends it back to review, so students always book what was checked.

## Status → what to show on the dashboard

| `lodges.status` | Show |
|---|---|
| `draft` | "Needs changes" with `review_note` if set, plus a **Resubmit** button (`submitLodge`) |
| `pending_review` | "In review" |
| `verified` | "Live" (+ "Scout inspected" badge if an approved inspection exists) |
| `suspended` | "Suspended" |

## Actions — `@/app/landlord/lodges/actions`

| Action | Use |
|---|---|
| `createLodge(prev, formData)` | `useActionState`. Returns `{ lodgeId }`, or `{ error, fieldErrors, values }` |
| `updateLodge.bind(null, lodgeId)` | Same form, minus agent/payee fields. Same return shape |
| `submitLodge(lodgeId)` | Send a draft back to review. `{ error? }` |
| `removeLodgePhoto(photoId)` | `{ error? }` |
| `uploadLodgePhoto(lodgeId, file)` — from `@/lib/listing-upload` | Client-side. `{ photoId }` or `{ error }` |

### Form field names (`LodgeInput` in `@/lib/listing`)

| Field | Notes |
|---|---|
| `title` | 3–120 chars |
| `description` | optional, ≤ 2000 |
| `area` | `Eziobodo` · `Umuchima` · `Ihiagwa` (`AREAS`) |
| `address` | 3–200 chars |
| `roomType` | `single_room` · `self_contain` · `room_and_parlour` · `flat` (`ROOM_TYPES`) |
| `amenities` | repeated checkbox, values from `AMENITIES` |
| `distanceToGateM`, `nearestGate` | optional; `main_gate` · `back_gate` |
| `rent` | naira, "250,000" is fine; 10,000–10,000,000 |
| `agentFee` | naira, student-paid, max 5% of rent, only with an agent |
| `commitmentFeePct` | `0`, or `10`–`20` |
| `landlordCommissionPct` | `0`–`10`, default `5` (landlord pays the agent from rent) |
| `partnerEmail` | landlord: their agent's LodgeLock email (optional). Agent: the landlord's email (**required**) |
| `rentToAgent` | checkbox, landlord only: pay rent to the named agent (agent must be ID-verified) |

Labels for amenities, room types and checklist items: `AMENITY_LABEL`, `ROOM_TYPE_LABEL`, `CHECKLIST_LABEL`.

## Reading photos

`getLodge(id)` now returns `photos: { id, url }[]` and `listLodges()` returns `coverUrl` per lodge. URLs are
signed for 1 hour and only issued to people allowed to see the lodge (anyone for live lodges; the lister,
admin and assigned scout for drafts). Use a plain `<img>` (or add the Supabase host to `next.config` images).
