-- Add per-menu-item configuration column to mobile_config
-- Stores: { [itemId]: { enabled: boolean, can_post: boolean } }
ALTER TABLE "mobile_config" ADD COLUMN IF NOT EXISTS "menu_items" JSONB;
