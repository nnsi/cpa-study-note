-- Migration: Add indexes to chat_sessions and chat_messages for query performance
-- Created: 2026-02-05

CREATE INDEX IF NOT EXISTS `chat_sessions_user_topic_idx` ON `chat_sessions` (`user_id`,`topic_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chat_messages_session_id_idx` ON `chat_messages` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chat_messages_session_created_idx` ON `chat_messages` (`session_id`,`created_at`);
