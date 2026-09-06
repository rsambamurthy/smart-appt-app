-- A ticket status change can now be made by a scoped Integration API Key
-- (the BPM/workflow tool's escalation action calling PATCH
-- /maintenance/:id/status) rather than a real user, so changed_by can no
-- longer be NOT NULL. changed_by_label carries a free-text actor description
-- for that case — same pattern as audit_logs.actor_label.
ALTER TABLE "ticket_status_logs" ALTER COLUMN "changed_by" DROP NOT NULL;
ALTER TABLE "ticket_status_logs" ADD COLUMN "changed_by_label" VARCHAR(120);
