-- Migration: Add deleted_at column to notes table for soft delete
-- Created: 2026-02-05

ALTER TABLE `notes` ADD `deleted_at` integer;
