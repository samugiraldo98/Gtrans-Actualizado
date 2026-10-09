CREATE TABLE `order_counters` (
	`owner` text PRIMARY KEY NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `customer_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `order_number` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `order_number_per_owner` ON `orders` (`owner`,`order_number`);
--> statement-breakpoint
UPDATE clients SET customer_id=id WHERE customer_id IS NULL;
--> statement-breakpoint
UPDATE orders SET order_number=sequence WHERE order_number IS NULL;
--> statement-breakpoint
INSERT INTO order_counters (owner,last_number) SELECT owner,MAX(order_number) FROM orders GROUP BY owner;
