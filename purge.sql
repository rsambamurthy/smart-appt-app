UPDATE dues_config   SET updated_by = (SELECT id FROM users WHERE phone = '+919791008530') WHERE updated_by  != (SELECT id FROM users WHERE phone = '+919791008530');
UPDATE one_time_dues SET created_by = (SELECT id FROM users WHERE phone = '+919791008530') WHERE created_by  != (SELECT id FROM users WHERE phone = '+919791008530');
UPDATE expenses      SET created_by = (SELECT id FROM users WHERE phone = '+919791008530') WHERE created_by  != (SELECT id FROM users WHERE phone = '+919791008530');
UPDATE payments      SET recorded_by = (SELECT id FROM users WHERE phone = '+919791008530') WHERE recorded_by IS NOT NULL AND recorded_by != (SELECT id FROM users WHERE phone = '+919791008530');
UPDATE documents     SET uploaded_by = (SELECT id FROM users WHERE phone = '+919791008530') WHERE uploaded_by != (SELECT id FROM users WHERE phone = '+919791008530');
DELETE FROM audit_logs WHERE performed_by IN (SELECT id FROM users WHERE phone != '+919791008530');
DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE phone != '+919791008530');
DELETE FROM users WHERE phone != '+919791008530';
