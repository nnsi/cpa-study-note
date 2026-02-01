-- Step 1: Create study_domains table
CREATE TABLE `study_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`emoji` text,
	`color` text,
	`is_public` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

-- Step 2: Insert default study domain (CPA)
INSERT INTO study_domains (id, name, description, emoji, color, is_public, created_at, updated_at)
VALUES ('cpa', '公認会計士試験', '公認会計士試験の学習をサポート', '📊', 'indigo', 1, strftime('%s', 'now'), strftime('%s', 'now'));
--> statement-breakpoint

-- Step 3: Create user_study_domains table
CREATE TABLE `user_study_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`study_domain_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`study_domain_id`) REFERENCES `study_domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_study_domains_user_id_idx` ON `user_study_domains` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_study_domains_study_domain_id_idx` ON `user_study_domains` (`study_domain_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_study_domains_user_id_study_domain_id_unique` ON `user_study_domains` (`user_id`,`study_domain_id`);
--> statement-breakpoint

-- Step 4: Recreate subjects table with new schema (SQLite requires table recreation for NOT NULL FK)
CREATE TABLE `subjects_new` (
	`id` text PRIMARY KEY NOT NULL,
	`study_domain_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`emoji` text,
	`color` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`study_domain_id`) REFERENCES `study_domains`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint

-- Step 5: Migrate existing subjects data with emoji/color mapping
INSERT INTO subjects_new (id, study_domain_id, name, description, emoji, color, display_order, created_at, updated_at)
SELECT
  id,
  'cpa',
  name,
  description,
  CASE name
    WHEN '財務会計論' THEN '📘'
    WHEN '管理会計論' THEN '📗'
    WHEN '監査論' THEN '📙'
    WHEN '企業法' THEN '📕'
    WHEN '租税法' THEN '📓'
    WHEN '経営学' THEN '📒'
    WHEN '経済学' THEN '📔'
    WHEN '民法' THEN '📖'
    ELSE NULL
  END,
  CASE name
    WHEN '財務会計論' THEN 'blue'
    WHEN '管理会計論' THEN 'emerald'
    WHEN '監査論' THEN 'amber'
    WHEN '企業法' THEN 'rose'
    WHEN '租税法' THEN 'violet'
    WHEN '経営学' THEN 'yellow'
    WHEN '経済学' THEN 'orange'
    WHEN '民法' THEN 'slate'
    ELSE NULL
  END,
  display_order,
  created_at,
  updated_at
FROM subjects;
--> statement-breakpoint

-- Step 6: Drop old subjects table and rename new one
DROP TABLE subjects;
--> statement-breakpoint
ALTER TABLE subjects_new RENAME TO subjects;
--> statement-breakpoint

-- Step 7: Create indexes for subjects
CREATE INDEX `subjects_study_domain_id_idx` ON `subjects` (`study_domain_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_study_domain_id_name_unique` ON `subjects` (`study_domain_id`,`name`);
--> statement-breakpoint

-- Step 8: Add default_study_domain_id to users (ON DELETE SET NULL for data integrity)
ALTER TABLE `users` ADD `default_study_domain_id` text REFERENCES study_domains(id) ON DELETE SET NULL;
--> statement-breakpoint

-- Step 9: Set default study domain for existing users
UPDATE users SET default_study_domain_id = 'cpa';
--> statement-breakpoint

-- Step 10: Link existing users to CPA study domain
INSERT INTO user_study_domains (id, user_id, study_domain_id, joined_at)
SELECT
  'usd_' || lower(hex(randomblob(10))),
  id,
  'cpa',
  created_at
FROM users;
