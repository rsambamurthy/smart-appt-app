-- ============================================================
-- SmartAppt: Full Purge
-- Deletes ALL data except the SUPER_USER account and their
-- association record (required FK, cannot be null).
--
-- Run from CMD:
--   docker exec -i smartappt-postgres psql -U postgres -d smartappt < purge_all.sql
-- ============================================================

-- 1. Leaf-level tables (no FK children)
DELETE FROM payments;
DELETE FROM poll_votes;
DELETE FROM announcement_reads;

-- 2. Bills (refs one_time_dues, units)
DELETE FROM bills;

-- 3. Ticket sub-records (refs maintenance_tickets)
DELETE FROM ticket_attachments;
DELETE FROM ticket_status_logs;
DELETE FROM maintenance_tickets;

-- 4. Visitors
DELETE FROM visitors;
DELETE FROM frequent_visitors;

-- 5. Communication
DELETE FROM announcements;
DELETE FROM documents;
DELETE FROM polls;

-- 6. Expenses (expense refs recurring_expenses + vendors → delete in order)
DELETE FROM expenses;
DELETE FROM expense_budgets;
DELETE FROM recurring_expenses;
DELETE FROM vendors;
DELETE FROM expense_category_configs;

-- 7. Dues
DELETE FROM one_time_dues;
DELETE FROM dues_config;

-- 8. Auth / audit
DELETE FROM user_invites;
DELETE FROM audit_logs;
DELETE FROM refresh_tokens
  WHERE user_id != (SELECT id FROM users WHERE phone = '+919791008530');

-- 9. Users — keep only SUPER_USER
DELETE FROM users
  WHERE phone != '+919791008530';

-- 10. Units (all, since no users are assigned to them anymore)
DELETE FROM units;

-- 11. Association config and associations — keep the super user's association
DELETE FROM association_config
  WHERE association_id != (SELECT association_id FROM users WHERE phone = '+919791008530');

DELETE FROM associations
  WHERE id != (SELECT association_id FROM users WHERE phone = '+919791008530');

-- Done
SELECT 'Purge complete. Remaining users: ' || COUNT(*) AS result FROM users;
