CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`image_id` text NOT NULL,
	`topic_id` text,
	`suggested_topic_ids` text,
	`marked_as_understood` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `exercises_user_id_idx` ON `exercises` (`user_id`);
--> statement-breakpoint
CREATE INDEX `exercises_topic_id_idx` ON `exercises` (`topic_id`);
--> statement-breakpoint
CREATE INDEX `exercises_image_id_idx` ON `exercises` (`image_id`);
