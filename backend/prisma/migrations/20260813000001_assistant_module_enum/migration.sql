-- Adding ASSISTANT to ModuleKey lives in its own migration on purpose.
--
-- Postgres allows ALTER TYPE ... ADD VALUE inside a transaction, which is what
-- Prisma wraps every migration in, but it refuses to let the new value be USED
-- in that same transaction. Any migration that both adds the value and inserts
-- a row referencing it fails at the insert. Splitting the two is the only
-- reliable fix; this is the same constraint that kept UPI out of PaymentMode.

ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'ASSISTANT';
