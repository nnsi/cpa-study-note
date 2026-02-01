-- Migration: Add user_bookmarks table
-- Created: 2026-02-02

CREATE TABLE `user_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_bookmarks_user_id_target_type_target_id_unique` ON `user_bookmarks` (`user_id`,`target_type`,`target_id`);
--> statement-breakpoint
CREATE INDEX `user_bookmarks_user_id_idx` ON `user_bookmarks` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_bookmarks_user_type_idx` ON `user_bookmarks` (`user_id`,`target_type`);
