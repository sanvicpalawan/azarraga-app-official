CREATE TABLE `quotation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quotation_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`quantity` integer NOT NULL,
	`sqft` real NOT NULL,
	`rate` real NOT NULL,
	`pricing_method` text NOT NULL,
	`section_company` text DEFAULT 'Analok' NOT NULL,
	`section_type` text NOT NULL,
	`glass` text NOT NULL,
	`color` text NOT NULL,
	`lock` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`total` real NOT NULL,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quotation_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`project_name` text NOT NULL,
	`project_address` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`grand_total` real DEFAULT 0 NOT NULL,
	`total_sqft` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_quotation_number_unique` ON `quotations` (`quotation_number`);