-- Migration: Add study_plans, study_plan_items, study_plan_revisions tables
-- Created: 2026-02-07

CREATE TABLE `study_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `intent` text,
  `scope` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `archived_at` integer
);

CREATE INDEX `study_plans_user_id_idx` ON `study_plans` (`user_id`);
CREATE INDEX `study_plans_user_archived_idx` ON `study_plans` (`user_id`, `archived_at`);

CREATE TABLE `study_plan_items` (
  `id` text PRIMARY KEY NOT NULL,
  `study_plan_id` text NOT NULL REFERENCES `study_plans`(`id`) ON DELETE CASCADE,
  `topic_id` text REFERENCES `topics`(`id`) ON DELETE SET NULL,
  `description` text NOT NULL,
  `rationale` text,
  `order_index` integer NOT NULL,
  `created_at` integer NOT NULL
);

CREATE INDEX `study_plan_items_plan_id_idx` ON `study_plan_items` (`study_plan_id`);
CREATE INDEX `study_plan_items_topic_id_idx` ON `study_plan_items` (`topic_id`);

CREATE TABLE `study_plan_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `study_plan_id` text NOT NULL REFERENCES `study_plans`(`id`) ON DELETE CASCADE,
  `summary` text NOT NULL,
  `reason` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE INDEX `study_plan_revisions_plan_id_idx` ON `study_plan_revisions` (`study_plan_id`);
