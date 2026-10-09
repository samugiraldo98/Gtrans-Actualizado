CREATE TABLE `payment_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payment_id` text NOT NULL,
	`before_data` text NOT NULL,
	`after_data` text NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `carriers` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `carriers` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `delete_requested_at` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `updated` text;