-- ============================================================
-- Migration 00015: Rename 'strain' column to 'variety'
-- More appropriate for a gastronomy/fine food platform
-- Safe: only renames if column still exists as 'strain'
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'strain'
  ) THEN
    ALTER TABLE items RENAME COLUMN strain TO variety;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'strain'
  ) THEN
    ALTER TABLE order_items RENAME COLUMN strain TO variety;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_items_strain'
  ) THEN
    ALTER INDEX idx_items_strain RENAME TO idx_items_variety;
  END IF;
END $$;
