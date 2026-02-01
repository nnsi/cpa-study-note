-- Migration: Simplify category hierarchy
-- Old: 大カテゴリ (depth=1) → 中カテゴリ (depth=2) → 論点
-- New: カテゴリ (depth=1) → 論点
--
-- Topics are linked to depth=2 categories, so we:
-- 1. Soft-delete depth=1 categories (大カテゴリ) - they have no topics linked
-- 2. Promote depth=2 categories to top-level (parentId=null, depth=1)

-- Step 1: Soft-delete depth=1 categories (大カテゴリ)
-- These are identified by: depth=1 AND parent_id IS NULL
-- Since topics are linked only to depth=2 categories, this is safe
UPDATE categories
SET deleted_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE depth = 1 AND parent_id IS NULL AND deleted_at IS NULL;

-- Step 2: Promote depth=2 categories to top-level
-- These had parent_id pointing to the now-deleted depth=1 categories
UPDATE categories
SET parent_id = NULL, depth = 1
WHERE depth = 2 AND deleted_at IS NULL;
