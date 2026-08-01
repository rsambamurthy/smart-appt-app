-- Allow maintenance tickets without a unit (office-bearer roles have no unit)
ALTER TABLE "maintenance_tickets" ALTER COLUMN "unit_id" DROP NOT NULL;
