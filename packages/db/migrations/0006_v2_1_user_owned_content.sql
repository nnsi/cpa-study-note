-- v2.1 Migration: User-Owned Content
-- This migration changes from shared public content to user-owned content

-- Step 1: Add deleted_at to users table
ALTER TABLE `users` ADD `deleted_at` integer;
--> statement-breakpoint

-- Step 2: Recreate study_domains table with user_id and deleted_at, removing is_public
CREATE TABLE `study_domains_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`emoji` text,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Step 3: Migrate study_domains data - assign existing domains to each user that joined them
INSERT INTO study_domains_new (id, user_id, name, description, emoji, color, created_at, updated_at, deleted_at)
SELECT
  'sd_' || lower(hex(randomblob(10))) || '_' || usd.user_id,
  usd.user_id,
  sd.name,
  sd.description,
  sd.emoji,
  sd.color,
  usd.joined_at,
  usd.joined_at,
  NULL
FROM study_domains sd
INNER JOIN user_study_domains usd ON sd.id = usd.study_domain_id;
--> statement-breakpoint

-- Step 4: Create a mapping table for old domain IDs to new domain IDs per user
CREATE TABLE `_domain_migration_map` (
  `old_domain_id` text NOT NULL,
  `user_id` text NOT NULL,
  `new_domain_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO _domain_migration_map (old_domain_id, user_id, new_domain_id)
SELECT
  usd.study_domain_id,
  usd.user_id,
  sdn.id
FROM user_study_domains usd
INNER JOIN study_domains_new sdn ON sdn.user_id = usd.user_id
INNER JOIN study_domains sd ON sd.id = usd.study_domain_id AND sd.name = sdn.name;
--> statement-breakpoint

-- Step 5: Drop old study_domains and rename new
DROP TABLE study_domains;
--> statement-breakpoint
ALTER TABLE study_domains_new RENAME TO study_domains;
--> statement-breakpoint

-- Step 6: Create indexes for study_domains
CREATE INDEX `study_domains_user_id_idx` ON `study_domains` (`user_id`);
--> statement-breakpoint
CREATE INDEX `study_domains_user_deleted_idx` ON `study_domains` (`user_id`, `deleted_at`);
--> statement-breakpoint

-- Step 7: Recreate subjects table with user_id and deleted_at
CREATE TABLE `subjects_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`study_domain_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`emoji` text,
	`color` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`study_domain_id`) REFERENCES `study_domains`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint

-- Step 8: Migrate subjects data - duplicate per user
INSERT INTO subjects_new (id, user_id, study_domain_id, name, description, emoji, color, display_order, created_at, updated_at, deleted_at)
SELECT
  'subj_' || lower(hex(randomblob(10))) || '_' || dmm.user_id,
  dmm.user_id,
  dmm.new_domain_id,
  s.name,
  s.description,
  s.emoji,
  s.color,
  s.display_order,
  s.created_at,
  s.updated_at,
  NULL
FROM subjects s
INNER JOIN _domain_migration_map dmm ON s.study_domain_id = dmm.old_domain_id;
--> statement-breakpoint

-- Step 9: Create subject mapping
CREATE TABLE `_subject_migration_map` (
  `old_subject_id` text NOT NULL,
  `user_id` text NOT NULL,
  `new_subject_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO _subject_migration_map (old_subject_id, user_id, new_subject_id)
SELECT
  s.id,
  dmm.user_id,
  sn.id
FROM subjects s
INNER JOIN _domain_migration_map dmm ON s.study_domain_id = dmm.old_domain_id
INNER JOIN subjects_new sn ON sn.user_id = dmm.user_id AND sn.name = s.name AND sn.study_domain_id = dmm.new_domain_id;
--> statement-breakpoint

-- Step 10: Drop old subjects and rename new
DROP TABLE subjects;
--> statement-breakpoint
ALTER TABLE subjects_new RENAME TO subjects;
--> statement-breakpoint

-- Step 11: Create indexes for subjects
CREATE INDEX `subjects_user_id_idx` ON `subjects` (`user_id`);
--> statement-breakpoint
CREATE INDEX `subjects_user_deleted_idx` ON `subjects` (`user_id`, `deleted_at`);
--> statement-breakpoint
CREATE INDEX `subjects_study_domain_id_idx` ON `subjects` (`study_domain_id`);
--> statement-breakpoint

-- Step 12: Recreate categories table with user_id and deleted_at
CREATE TABLE `categories_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`name` text NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`parent_id` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `categories_new`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Step 13: Migrate categories data (top-level first, then nested)
INSERT INTO categories_new (id, user_id, subject_id, name, depth, parent_id, display_order, created_at, updated_at, deleted_at)
SELECT
  'cat_' || lower(hex(randomblob(10))) || '_' || smm.user_id,
  smm.user_id,
  smm.new_subject_id,
  c.name,
  c.depth,
  NULL,
  c.display_order,
  c.created_at,
  c.updated_at,
  NULL
FROM categories c
INNER JOIN _subject_migration_map smm ON c.subject_id = smm.old_subject_id
WHERE c.parent_id IS NULL;
--> statement-breakpoint

-- Step 14: Create category mapping for parent resolution
CREATE TABLE `_category_migration_map` (
  `old_category_id` text NOT NULL,
  `user_id` text NOT NULL,
  `new_category_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO _category_migration_map (old_category_id, user_id, new_category_id)
SELECT
  c.id,
  smm.user_id,
  cn.id
FROM categories c
INNER JOIN _subject_migration_map smm ON c.subject_id = smm.old_subject_id
INNER JOIN categories_new cn ON cn.user_id = smm.user_id AND cn.name = c.name AND cn.subject_id = smm.new_subject_id
WHERE c.parent_id IS NULL;
--> statement-breakpoint

-- Step 15: Migrate nested categories (depth > 0) with parent mapping
INSERT INTO categories_new (id, user_id, subject_id, name, depth, parent_id, display_order, created_at, updated_at, deleted_at)
SELECT
  'cat_' || lower(hex(randomblob(10))) || '_' || smm.user_id,
  smm.user_id,
  smm.new_subject_id,
  c.name,
  c.depth,
  cmm.new_category_id,
  c.display_order,
  c.created_at,
  c.updated_at,
  NULL
FROM categories c
INNER JOIN _subject_migration_map smm ON c.subject_id = smm.old_subject_id
INNER JOIN _category_migration_map cmm ON c.parent_id = cmm.old_category_id AND cmm.user_id = smm.user_id
WHERE c.parent_id IS NOT NULL;
--> statement-breakpoint

-- Step 16: Update category migration map with nested categories
INSERT INTO _category_migration_map (old_category_id, user_id, new_category_id)
SELECT
  c.id,
  smm.user_id,
  cn.id
FROM categories c
INNER JOIN _subject_migration_map smm ON c.subject_id = smm.old_subject_id
INNER JOIN categories_new cn ON cn.user_id = smm.user_id AND cn.name = c.name AND cn.subject_id = smm.new_subject_id
WHERE c.parent_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM _category_migration_map cmm WHERE cmm.old_category_id = c.id AND cmm.user_id = smm.user_id
);
--> statement-breakpoint

-- Step 17: Drop old categories and rename new
DROP TABLE categories;
--> statement-breakpoint
ALTER TABLE categories_new RENAME TO categories;
--> statement-breakpoint

-- Step 18: Create indexes for categories
CREATE INDEX `categories_user_id_idx` ON `categories` (`user_id`);
--> statement-breakpoint
CREATE INDEX `categories_user_deleted_idx` ON `categories` (`user_id`, `deleted_at`);
--> statement-breakpoint
CREATE INDEX `categories_subject_id_idx` ON `categories` (`subject_id`);
--> statement-breakpoint
CREATE INDEX `categories_parent_id_idx` ON `categories` (`parent_id`);
--> statement-breakpoint

-- Step 19: Recreate topics table with user_id and deleted_at
CREATE TABLE `topics_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`difficulty` text,
	`topic_type` text,
	`ai_system_prompt` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Step 20: Migrate topics data
INSERT INTO topics_new (id, user_id, category_id, name, description, difficulty, topic_type, ai_system_prompt, display_order, created_at, updated_at, deleted_at)
SELECT
  'topic_' || lower(hex(randomblob(10))) || '_' || cmm.user_id,
  cmm.user_id,
  cmm.new_category_id,
  t.name,
  t.description,
  t.difficulty,
  t.topic_type,
  t.ai_system_prompt,
  t.display_order,
  t.created_at,
  t.updated_at,
  NULL
FROM topics t
INNER JOIN _category_migration_map cmm ON t.category_id = cmm.old_category_id;
--> statement-breakpoint

-- Step 21: Create topic mapping for related data
CREATE TABLE `_topic_migration_map` (
  `old_topic_id` text NOT NULL,
  `user_id` text NOT NULL,
  `new_topic_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO _topic_migration_map (old_topic_id, user_id, new_topic_id)
SELECT
  t.id,
  cmm.user_id,
  tn.id
FROM topics t
INNER JOIN _category_migration_map cmm ON t.category_id = cmm.old_category_id
INNER JOIN topics_new tn ON tn.user_id = cmm.user_id AND tn.name = t.name AND tn.category_id = cmm.new_category_id;
--> statement-breakpoint

-- Step 22: Update user_topic_progress to reference new topic IDs
UPDATE user_topic_progress
SET topic_id = (
  SELECT tmm.new_topic_id
  FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = user_topic_progress.topic_id
    AND tmm.user_id = user_topic_progress.user_id
)
WHERE EXISTS (
  SELECT 1 FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = user_topic_progress.topic_id
    AND tmm.user_id = user_topic_progress.user_id
);
--> statement-breakpoint

-- Step 23: Update topic_check_history to reference new topic IDs
UPDATE topic_check_history
SET topic_id = (
  SELECT tmm.new_topic_id
  FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = topic_check_history.topic_id
    AND tmm.user_id = topic_check_history.user_id
)
WHERE EXISTS (
  SELECT 1 FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = topic_check_history.topic_id
    AND tmm.user_id = topic_check_history.user_id
);
--> statement-breakpoint

-- Step 24: Update chat_sessions to reference new topic IDs
UPDATE chat_sessions
SET topic_id = (
  SELECT tmm.new_topic_id
  FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = chat_sessions.topic_id
    AND tmm.user_id = chat_sessions.user_id
)
WHERE EXISTS (
  SELECT 1 FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = chat_sessions.topic_id
    AND tmm.user_id = chat_sessions.user_id
);
--> statement-breakpoint

-- Step 25: Update notes to reference new topic IDs
UPDATE notes
SET topic_id = (
  SELECT tmm.new_topic_id
  FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = notes.topic_id
    AND tmm.user_id = notes.user_id
)
WHERE EXISTS (
  SELECT 1 FROM _topic_migration_map tmm
  WHERE tmm.old_topic_id = notes.topic_id
    AND tmm.user_id = notes.user_id
);
--> statement-breakpoint

-- Step 26: Drop old topics and rename new
DROP TABLE topics;
--> statement-breakpoint
ALTER TABLE topics_new RENAME TO topics;
--> statement-breakpoint

-- Step 27: Create indexes for topics
CREATE INDEX `topics_user_id_idx` ON `topics` (`user_id`);
--> statement-breakpoint
CREATE INDEX `topics_user_deleted_idx` ON `topics` (`user_id`, `deleted_at`);
--> statement-breakpoint
CREATE INDEX `topics_category_id_idx` ON `topics` (`category_id`);
--> statement-breakpoint

-- Step 28: Drop migration mapping tables
DROP TABLE `_topic_migration_map`;
--> statement-breakpoint
DROP TABLE `_category_migration_map`;
--> statement-breakpoint
DROP TABLE `_subject_migration_map`;
--> statement-breakpoint
DROP TABLE `_domain_migration_map`;
--> statement-breakpoint

-- Step 29: Drop user_study_domains table (no longer needed)
DROP TABLE `user_study_domains`;
--> statement-breakpoint

-- Step 30: Remove default_study_domain_id from users (no longer needed)
-- SQLite doesn't support DROP COLUMN directly before 3.35, so we recreate the table
CREATE TABLE `users_new` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO users_new (id, email, name, avatar_url, created_at, updated_at, deleted_at)
SELECT id, email, name, avatar_url, created_at, updated_at, deleted_at FROM users;
--> statement-breakpoint
DROP TABLE users;
--> statement-breakpoint
ALTER TABLE users_new RENAME TO users;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
