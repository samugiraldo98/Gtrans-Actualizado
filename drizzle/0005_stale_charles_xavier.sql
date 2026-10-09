CREATE TABLE `expense_concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_concept_per_owner` ON `expense_concepts` (`owner`,`name`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`concept_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`reference` text NOT NULL,
	`created` text NOT NULL,
	`file_name` text,
	`file_mime` text,
	`file_size` integer DEFAULT 0 NOT NULL
);
