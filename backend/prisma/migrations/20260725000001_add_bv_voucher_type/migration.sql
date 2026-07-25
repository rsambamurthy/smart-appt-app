-- Add BV (Bank Voucher) to VoucherType enum
-- CV is repurposed from "Contra Voucher" to "Cash Voucher"
ALTER TYPE "VoucherType" ADD VALUE IF NOT EXISTS 'BV';
