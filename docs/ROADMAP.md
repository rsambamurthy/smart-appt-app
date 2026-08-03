# SmartAppt Gold — Product Roadmap

*Gap analysis and build sequence. Written 3 August 2026, against the state of the repo on `feature/accounting-v2`.*

---

## Where the product stands

13 backend modules, 37 Prisma models, roughly 180 endpoints. What is genuinely built and in use:

| Area | State |
|---|---|
| Auth | OTP, M-PIN, Google. Role-based access across 6 roles. |
| Dues | Config, bill generation, payments, penalty calculation, Razorpay, arrears, bulk import. |
| Accounting | Double-entry ledger, chart of accounts, business-partner sub-ledgers, voucher types, Trial Balance, Day Book, Cash/Bank Book, Receipts & Payments, Income & Expenditure, Balance Sheet with schedules, FY close. |
| Expenses | Vendors, categories, budgets, recurring expenses. |
| Maintenance | Tickets with attachments and status history. |
| Communication | Announcements, document repository, polls. Push (FCM), email, SMS and WhatsApp channels. |
| Visitors | Gate console, walk-ins, pre-approval with scannable QR, camera scanner, deliveries, photo capture with retention policy. |
| Platform | Audit log, mobile config matrix, menu configuration, analytics. |

That is a real product. What follows is what stands between it and a complete association management system.

---

## 1. Governance — the structural gap

SmartAppt is currently a *management* tool. A registered association also has statutory obligations, and none of them are addressable in the product today. This is the gap a committee secretary will find in the first demo.

| Item | Effort | Notes |
|---|---|---|
| Meetings & AGM | 8–10 d | Notice with agenda, RSVP, quorum tracking, attendance register, proxy handling, resolutions, minutes with circulation and acceptance. `MEETING` and `MINUTES` exist today only as document categories. |
| Committee elections | 4–5 d | Nominations, eligibility check, secret ballot, results. `Poll`/`PollVote` already provides most of the voting machinery. |
| Register of members | 2–3 d | The formal register, with ownership changes and effective dates. Feeds AGM eligibility and quorum. |
| Compliance calendar | 2 d | Filing dates, auditor appointment, renewal reminders. Mostly a scheduled-notification surface over a small model. |

**Why it matters commercially:** every competitor in this market leads with dues and accounting. Governance is where they are all thin, and it is the part a committee cannot substitute with a spreadsheet.

---

## 2. Money — closing the year cleanly

The accounting engine is sound. These are the pieces a treasurer needs before an audit is painless.

| Item | Effort | Notes |
|---|---|---|
| **Unit statement of account** | 1.5 d | Per-flat ledger: opening balance, bills raised, payments, penalties, closing. The single most-asked resident question. Smallest effort, highest daily value in the whole list. |
| **Bank reconciliation** | 6 d | Statement import, auto-match on amount/date/reference, manual match, unreconciled report. Without it the cash book is never provably correct. |
| Voucher print + draft/post workflow | 4.5 d | Numbered printable vouchers, and a draft → approved → posted lifecycle. Today a treasurer posts straight to the ledger with no second pair of eyes. |
| Budget vs actual | 2 d | `ExpenseBudget` exists and nothing reads it. Variance by category and period. |
| TDS on contractor payments | 3 d | Deduction at payment, challan tracking, quarterly summary. Associations are liable for this. |
| Penalty posting to ledger | 1 d | `penalty` is computed on bills but never becomes a journal line, so the ledger understates income. |
| GST | 4 d | Only if an association crosses the threshold. Defer until a customer needs it. |

---

## 3. Daily operations

No data model exists for any of the following. Each is self-contained, which makes them good parallel work.

| Item | Effort | Notes |
|---|---|---|
| **Amenity booking** | 5 d | Clubhouse, gym, party hall. Slots, rules, charges that post to dues, cancellations. Usually the second thing asked for after dues, and it demos well. |
| Assets & AMC register | 4 d | Lifts, pumps, DG sets, fire equipment. Purchase, warranty, AMC renewal reminders. `ASSET` currently exists only as an account type. |
| Parking allotment | 3 d | Slot register, allotment per unit, guest parking, violations. |
| Staff & attendance | 5 d | Housekeeping and security roster, attendance, leave. Feeds payroll expense. |
| Tenancy lifecycle | 4 d | `is_owner` and `move_in_date` exist, but there is no lease record, no owner/tenant billing split, no move-in/move-out checklist. |
| Material gate pass | 2 d | Goods leaving the premises, approved by the flat. Natural extension of the gate console. |
| Utility meter readings | 4 d | Reading capture, consumption, sub-metered billing into dues. |

---

## 4. Platform maturity

### Automated tests — the honest one

`jest` is configured in `backend/package.json`. There are **zero test files**.

In a single working session the following reached a running system and were found by hand, after the fact:

- the APK built against the wrong Railway backend, so no one could log in
- `GET /visitors/:id/photo` served any visitor's photo to any authenticated member
- the gate console left the form populated because the reset sat behind a photo upload
- a `datetime-local` input silently blanked itself, so pre-approval could never submit
- the Share button never opened a share sheet, because Android WebView has no `navigator.share`

None of these are exotic. A modest suite over the accounting calculations, the RBAC matrix and the dues engine would have caught the second and third outright. **Suggested: 5 d to stand up the harness and cover accounting + RBAC, then a standing rule that bug fixes ship with a test.**

### Other platform work

| Item | Effort | Notes |
|---|---|---|
| Committee handover export | 3 d | When the committee changes, the outgoing treasurer must hand over verifiable data. A self-serve full export is a trust feature. |
| Notification preferences | 3 d | Per-user, per-channel opt-in. Currently channels are hardcoded at each call site. |
| Maker-checker on financial actions | 3 d | A Treasurer can currently do everything financial alone. |
| Self-serve association onboarding | 5 d | Required before you can sell without doing setup by hand. |
| Subscription billing for SmartAppt itself | 5 d | Your revenue, not the association's. |

---

## Suggested sequence

**Phase 1 — finish what a treasurer needs (≈ 3 weeks)**

1. Unit statement of account (1.5 d)
2. Penalty posting to ledger (1 d)
3. Budget vs actual (2 d)
4. Bank reconciliation (6 d)
5. Test harness + accounting and RBAC coverage (5 d)

Rationale: the accounting module is the product's strongest asset and its most fragile. Close it out and put tests under it before adding surface area.

**Phase 2 — win the demo (≈ 3 weeks)**

6. Amenity booking (5 d)
7. Assets & AMC register (4 d)
8. Voucher print + draft/post workflow (4.5 d)

**Phase 3 — become an association system (≈ 4 weeks)**

9. Meetings & AGM (8–10 d)
10. Register of members (2–3 d)
11. Committee elections (4–5 d)
12. Committee handover export (3 d)

**Phase 4 — sell it without you in the room**

13. Self-serve onboarding, subscription billing, notification preferences, maker-checker.

Parking, staff attendance, tenancy, gate pass and meter readings slot in wherever a specific customer asks. They are independent and none of them block the others.

---

## Deliberately not on this list

- **A separate Financial Accounting product.** Discussed earlier and still worth doing eventually, but extracting it now would fork effort across two products before either is finished.
- **AI features.** The accounting data is clean enough to support them and there is a real product there. It is a distraction until Phase 1 is done.
- **iOS.** The Capacitor project supports it; nobody has asked.
