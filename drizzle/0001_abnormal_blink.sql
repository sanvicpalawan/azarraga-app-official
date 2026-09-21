CREATE TABLE `global_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`logo_key` text,
	`address` text DEFAULT '' NOT NULL,
	`contact_numbers` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`tin` text DEFAULT '' NOT NULL,
	`bank_account_name` text DEFAULT '' NOT NULL,
	`bank_account_number` text DEFAULT '' NOT NULL,
	`bank_name` text DEFAULT '' NOT NULL,
	`bank_branch` text DEFAULT '' NOT NULL,
	`terms_conditions` text DEFAULT '' NOT NULL,
	`pdf_header` text DEFAULT 'QUOTATION' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_attributes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_attributes_type_name` ON `product_attributes` (`type`,`name`);--> statement-breakpoint
CREATE INDEX `idx_product_attributes_type` ON `product_attributes` (`type`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_categories_name` ON `product_categories` (`name`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`base_price` real DEFAULT 0 NOT NULL,
	`image_key` text,
	`image_path` text,
	`description` text DEFAULT '' NOT NULL,
	`default_series_id` integer,
	`default_glass_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`default_series_id`) REFERENCES `product_attributes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`default_glass_id`) REFERENCES `product_attributes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_products_name_category` ON `products` (`name`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_products_category_id` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_quotations_status_updated` ON `quotations` (`status`,`updated_at`);