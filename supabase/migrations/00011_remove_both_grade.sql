-- ============================================================
-- Migration 00011: Remove 'both' grade_visibility option
-- premium users see all categories regardless
-- ============================================================

-- Convert existing 'both' categories to 'classic'
UPDATE categories SET grade_visibility = 'classic' WHERE grade_visibility = 'both';

-- Change default
ALTER TABLE categories ALTER COLUMN grade_visibility SET DEFAULT 'classic';

-- Drop old constraint and add new one
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_grade_visibility_check;
ALTER TABLE categories ADD CONSTRAINT categories_grade_visibility_check
  CHECK (grade_visibility IN ('classic', 'premium'));
