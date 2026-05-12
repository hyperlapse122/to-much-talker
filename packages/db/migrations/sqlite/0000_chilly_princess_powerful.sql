CREATE TABLE `channel_settings` (
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`max_chars` integer,
	`max_queue_size` integer DEFAULT 20 NOT NULL,
	`queue_strategy` text DEFAULT 'drop-oldest' NOT NULL,
	`queue_strategy_params` text,
	`bound_text_channel_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `channel_id`)
);
--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`api_key_encrypted` text,
	`api_key_iv` text,
	`api_key_auth_tag` text,
	`api_key_version` integer,
	`allowed_models` text NOT NULL,
	`default_model` text DEFAULT 'google/gemini-3.1-flash-tts-preview' NOT NULL,
	`default_voice` text,
	`max_chars` integer DEFAULT 500 NOT NULL,
	`max_price_cents` integer,
	`idle_text_inactivity_ms` integer DEFAULT 300000 NOT NULL,
	`idle_leave_on_empty` integer DEFAULT true NOT NULL,
	`permissions_role_id` text,
	`locale` text DEFAULT 'en' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setting_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text,
	`user_id` text,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`actor_id` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tts_message_log` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`model` text NOT NULL,
	`char_count` integer NOT NULL,
	`est_cost_micros` integer NOT NULL,
	`actual_cost_micros` integer,
	`queued_at` integer NOT NULL,
	`played_at` integer,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`preferred_model` text,
	`preferred_voice` text,
	`preferred_locale` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
