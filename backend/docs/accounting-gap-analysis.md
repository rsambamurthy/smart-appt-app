# SmartAppt Accounting — Gap Analysis

**Date:** 2 August 2026
**Scope:** `backend/src/modules/accounting` assessed against standard accounting
practice for an Indian apartment owners' association.
**Purpose:** identify what is missing and in what order to build it. No design
detail, no code.

---

## 1. What already exists

More than a first look suggests. The foundation is sound double-entry.

| Area | Status |
|---|---|
| Chart of accounts | Hierarchy, groups, control accounts, system-seeded defaults |
| Business partners | Unit / vendor / bank categories, BP types, opening balances |
| Sub-ledgers | Control-account tagging, per-BP ledger view |
| Journals | Auto-posting from bills, payments, expenses, other receipts; manual entries; voucher numbering per FY |
| Opening balances | Per-BP and cash opening balance sync |
| Bulk data entry | Unit, vendor and bank statement upload with preview/apply |
| Year end | FY configuration, closure preview, close and reopen |
| Reports | Ledger, all-ledger, sub-ledger, P&L, Balance Sheet |

The `JournalEntry` model already carries `status` (DRAFT/POSTED/CANCELLED),
`source` (AUTO/MANUAL), a full workflow trail (`created_by`, `posted_by`,
`cancelled_by`, `cancellation_reason`) and `financial_year`. Most of the
scaffolding for a rigorous system is in place and simply unused.

---

## 2. Defects in what exists

These matter more than the missing features, because they silently produce wrong
numbers in reports people already rely on.

| # | Defect | Impact | Effort |
|---|---|---|---|
| D1 | **Reports ignore `status`.** `getPnL`, `getBalanceSheet`, `getLedger` and `getSubLedger` filter on `entry_date` and `association_id` only. DRAFT and CANCELLED entries are included in reported figures. | Cancelling an entry does not remove it from the accounts. Latent today because everything auto-posts as POSTED, but any use of the cancel workflow corrupts every report. | 0.5 d |
| D2 | **Paise are lost.** Both report queries cast `SUM(jl.debit)::bigint`, rounding `Decimal(15,2)` to whole rupees per account. | Balance Sheet can fail to balance by a few rupees; totals disagree with the ledger. Hard to explain to an auditor. | 0.5 d |
| D3 | **Expense account chosen by substring match.** The category must appear inside an account *name*, else it falls back to `4008 Administrative`. | Silent misclassification. Observed live: `LIFT_AMC` and `DEPOSIT` both landed on Administrative, ₹1,00,000 combined. | 1 d |
| D4 | **No reversal mechanism.** Corrections are done by editing journal lines directly. | No audit trail of what was changed. An auditor expects a reversing entry, not a mutated one. | 1.5 d |
| D5 | **Non-expenditure items enter through the expense screen.** A ₹80,000 fixed deposit was booked as an expense. | Overstates expenditure, hides the asset. Needs an asset-transfer path. | 1 d |
| D6 | **Control account setup is manual and silent.** Seeded `1004` has `is_control_account = false`; the sub-ledger produces nothing until it is switched on, a BP type created, and a BP card made per unit. `backfillBPTags` reports success having tagged zero rows. | Every new association starts with a broken sub-ledger and no indication of it. | 1 d |

**Subtotal: ~5.5 days.** D1 and D2 should be fixed before anything is built on
top of these reports.

---

## 3. Missing capability

### 3a. Statutory audit set

| Report | Status | Notes |
|---|---|---|
| Trial Balance | **Missing** | Every other report depends on it being right. Should show debit/credit columns per account with a grand-total equality check. |
| Receipts & Payments Account | **Missing** | Pure cash summary, opening to closing balance. This is the statement an association is normally required to present; its absence is the most significant single gap. |
| Income & Expenditure Account | Partial | `getPnL` computes the right numbers but is framed as a commercial P&L. Needs association terminology (Surplus/Deficit) and a grouped presentation. |
| Balance Sheet | Partial | Exists, but flat — no schedules, no grouping by sub-type, no prior-year comparative column. |
| Schedules / notes | **Missing** | Auditors expect supporting schedules for receivables, payables, funds and deposits. |

**Effort: ~6 days** (TB 1d, R&P 2d, I&E rework 1d, BS schedules + comparatives 2d)

### 3b. Day-to-day books

| Feature | Status | Notes |
|---|---|---|
| Cash Book | **Missing** | Ledger view of 1001 with running balance, date-filtered. Partly derivable from `getLedger`. |
| Bank Book | **Missing** | Same for 1002, per bank BP. |
| Day Book | **Missing** | All entries for a date range in voucher order — the treasurer's daily view. |
| Voucher printing | **Missing** | RV/PV vouchers as PDF for signature and filing. `reference_code` numbering already exists. |
| Draft → post workflow | **Unused** | `status` and `posted_by` exist but everything posts immediately. Enabling this gives maker-checker control. |

**Effort: ~5 days** (books 2d, voucher PDF 2d, post workflow 1d)

### 3c. Receivables control

| Feature | Status | Notes |
|---|---|---|
| Arrears ageing | **Missing** | Per flat, bucketed 0–30/31–60/61–90/90+. The sub-ledger data now supports this. |
| Unit statement of account | **Missing** | Opening balance, bills, payments, closing — issuable to an owner. |
| Collection efficiency | Partial | Some figures in `analytics.service`, not tied to the ledger. |
| Advance/credit handling | **Missing** | Overpayments have no defined treatment; currently just reduce the receivable. |
| Interest on arrears | Partial | Penalty exists on bills but is not posted to a separate income account per unit. |

**Effort: ~5 days**

### 3d. Bank reconciliation

| Feature | Status | Notes |
|---|---|---|
| Statement upload | **Exists** | `bank-upload.service.ts` — preview/apply already built. |
| Matching engine | **Missing** | No comparison of statement lines against journal entries. |
| Unreconciled report | **Missing** | Deposits in transit, uncleared cheques. |
| BRS statement | **Missing** | Formal reconciliation from bank balance to book balance. |
| Reconciliation status | **Missing** | No `reconciled_at` / `statement_ref` on journal lines — a schema change. |

**Effort: ~6 days**, the largest single item, but the upload half is done.

---

## 4. Schema changes required

Modest. Most of what is needed already exists.

| Change | For |
|---|---|
| `journal_lines.reconciled_at`, `.bank_statement_ref` | Bank reconciliation |
| `bank_statement_lines` table (or reuse the upload staging) | Matching engine |
| `accounts.report_group`, `.schedule_no` | Balance sheet schedules |
| `expense_category_configs.account_id` | Replaces the D3 substring match with an explicit mapping |
| `journal_entries.reversal_of_id` | Reversal trail (D4) |

No change needed for trial balance, day books, ageing or R&P — all derivable
from existing data.

---

## 5. Recommended order

| Phase | Contents | Effort | Rationale |
|---|---|---|---|
| **0** | D1, D2 | 1 d | Existing reports are wrong in ways that get worse the more is built on them. |
| **1** | Trial Balance, Cash Book, Bank Book, Day Book | 3 d | Cheap, entirely from existing data, immediately useful, and TB is the check that validates everything else. |
| **2** | D3, D5, `expense_category_configs.account_id` | 2.5 d | Stops new misclassification. Do before year-end reports are relied on. |
| **3** | Receipts & Payments, I&E rework, BS schedules + comparatives | 6 d | The audit set. Time it against your financial year end. |
| **4** | Arrears ageing, unit statement of account | 3 d | Highest visible value to the committee and owners. |
| **5** | Bank reconciliation | 6 d | Largest effort; do once the books above are trustworthy. |
| **6** | Voucher printing, draft/post workflow, D4 reversals | 4.5 d | Controls and formality. Valuable but not blocking. |

**Total ≈ 26 days.** Phases 0–2 (6.5 days) address every known correctness
problem and deliver the daily books; that is the natural first milestone.

---

## 6. Assumptions to confirm

1. **Financial year is April–March.** `association_config.financial_year_start_month`
   defaults to 4, consistent with this.
2. **Cash basis or accrual?** Bills are raised in advance, so the books are
   accrual. Receipts & Payments is cash — both are needed, and they will not
   agree. Worth confirming which your auditor treats as primary.
3. **Single association per deployment for reporting purposes.** All reports are
   scoped by `association_id`; no consolidated view is contemplated here.
4. **No statutory GST/TDS obligation.** If the association deducts TDS on
   contractor payments, that is additional scope not covered above.
