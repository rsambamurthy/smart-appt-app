-- ============================================================================
--  Check existing entries against the new voucher rules.  READ-ONLY.
--
--  Validation now applies to entries created or edited from here on. Anything
--  already posted keeps whatever voucher type it was given. Run this to see
--  what would fail the new rules, so nothing sits silently misclassified.
--
--  Cash/bank classification is by CODE, matching getCashBankAccounts():
--    cash = 1001, or an ASSET account with sub_type 'Cash'
--    bank = 1002, or an ASSET account with sub_type 'Bank'
-- ============================================================================


WITH money AS (
  SELECT id,
         CASE WHEN code = '1001' OR lower(sub_type) = 'cash' THEN 'CASH'
              WHEN code = '1002' OR lower(sub_type) = 'bank' THEN 'BANK'
         END AS kind
  FROM   accounts
  WHERE  association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND  type = 'ASSET'
    AND  (code IN ('1001','1002') OR lower(sub_type) IN ('cash','bank'))
),
tally AS (
  SELECT je.id, je.reference_code, je.voucher_type, je.source,
         je.entry_date, je.narration,
         COUNT(*)                                                   AS total_lines,
         COUNT(*) FILTER (WHERE m.kind = 'CASH')                    AS cash_lines,
         COUNT(*) FILTER (WHERE m.kind = 'BANK')                    AS bank_lines
  FROM   journal_entries je
  JOIN   journal_lines   jl ON jl.journal_entry_id = je.id
  LEFT   JOIN money      m  ON m.id = jl.account_id
  WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND  je.status = 'POSTED'
  GROUP  BY je.id, je.reference_code, je.voucher_type, je.source, je.entry_date, je.narration
)
SELECT entry_date, reference_code, voucher_type, source,
       cash_lines, bank_lines, total_lines,
       CASE
         WHEN voucher_type = 'BV' AND bank_lines = 0 THEN 'BV with no bank line'
         WHEN voucher_type = 'BV' AND bank_lines > 1 THEN 'BV touching two bank accounts'
         WHEN voucher_type = 'BV' AND cash_lines > 0 THEN 'BV also touching cash'
         WHEN voucher_type = 'CV' AND cash_lines = 0 THEN 'CV with no cash line'
         WHEN voucher_type = 'CV' AND cash_lines > 1 THEN 'CV touching two cash accounts'
         WHEN voucher_type = 'CV' AND bank_lines > 0 THEN 'CV also touching bank'
         WHEN voucher_type = 'JV' AND (cash_lines + bank_lines) > 0
              AND (cash_lines + bank_lines) <> total_lines THEN 'JV touching cash or bank'
         ELSE NULL
       END AS would_fail,
       left(narration, 45) AS narration
FROM   tally
WHERE  CASE
         WHEN voucher_type = 'BV' AND bank_lines = 0 THEN true
         WHEN voucher_type = 'BV' AND bank_lines > 1 THEN true
         WHEN voucher_type = 'BV' AND cash_lines > 0 THEN true
         WHEN voucher_type = 'CV' AND cash_lines = 0 THEN true
         WHEN voucher_type = 'CV' AND cash_lines > 1 THEN true
         WHEN voucher_type = 'CV' AND bank_lines > 0 THEN true
         WHEN voucher_type = 'JV' AND (cash_lines + bank_lines) > 0
              AND (cash_lines + bank_lines) <> total_lines THEN true
         ELSE false
       END
ORDER  BY entry_date;
-- Empty result = every existing entry already satisfies the new rules.


-- ── Entries misclassified by the OLD name-based inference ──────────────────
-- The previous logic looked for "bank" or "cash" inside the account NAME.
-- These are entries whose stored voucher_type disagrees with what the new
-- code-based classification would give. Auto-posted entries are included
-- because they set their own type directly.
WITH money AS (
  SELECT id,
         CASE WHEN code = '1001' OR lower(sub_type) = 'cash' THEN 'CASH'
              WHEN code = '1002' OR lower(sub_type) = 'bank' THEN 'BANK'
         END AS kind
  FROM   accounts
  WHERE  association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
    AND  type = 'ASSET'
    AND  (code IN ('1001','1002') OR lower(sub_type) IN ('cash','bank'))
)
SELECT je.entry_date, je.reference_code, je.voucher_type AS stored,
       CASE WHEN COUNT(*) FILTER (WHERE m.kind = 'BANK') > 0 THEN 'BV'
            WHEN COUNT(*) FILTER (WHERE m.kind = 'CASH') > 0 THEN 'CV'
            ELSE 'JV' END AS would_be,
       je.source, left(je.narration, 45) AS narration
FROM   journal_entries je
JOIN   journal_lines   jl ON jl.journal_entry_id = je.id
LEFT   JOIN money      m  ON m.id = jl.account_id
WHERE  je.association_id = '3f8e51ae-dc51-4640-ad32-7c47eaebc4e5'::uuid
  AND  je.status = 'POSTED'
GROUP  BY je.id, je.entry_date, je.reference_code, je.voucher_type, je.source, je.narration
HAVING je.voucher_type::text <> CASE
         WHEN COUNT(*) FILTER (WHERE m.kind = 'BANK') > 0 THEN 'BV'
         WHEN COUNT(*) FILTER (WHERE m.kind = 'CASH') > 0 THEN 'CV'
         ELSE 'JV' END
ORDER  BY je.entry_date;
-- Auto-posted RV/PV entries will appear here — that is expected, they use
-- receipt/payment voucher types rather than the three manual categories.
