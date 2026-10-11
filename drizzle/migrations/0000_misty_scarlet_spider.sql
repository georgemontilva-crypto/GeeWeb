CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` varchar(400) NOT NULL DEFAULT '',
	`image_url` varchar(600) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`type` varchar(16) NOT NULL DEFAULT 'porcentaje',
	`value` bigint NOT NULL,
	`min_subtotal` bigint NOT NULL DEFAULT 0,
	`max_uses` int,
	`used_count` int NOT NULL DEFAULT 0,
	`expires_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` varchar(40) NOT NULL,
	`mime` varchar(80) NOT NULL,
	`data` mediumblob NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`status` varchar(20) NOT NULL,
	`note` varchar(400) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int,
	`variant_id` int,
	`name` varchar(160) NOT NULL,
	`color` varchar(40) NOT NULL DEFAULT '',
	`size` varchar(40) NOT NULL DEFAULT '',
	`image_url` varchar(600) NOT NULL DEFAULT '',
	`price` bigint NOT NULL,
	`quantity` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(24) NOT NULL,
	`token` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pendiente',
	`customer_name` varchar(160) NOT NULL,
	`customer_email` varchar(191) NOT NULL,
	`customer_phone` varchar(60) NOT NULL DEFAULT '',
	`customer_document` varchar(60) NOT NULL DEFAULT '',
	`address` varchar(300) NOT NULL DEFAULT '',
	`address_extra` varchar(200) NOT NULL DEFAULT '',
	`city` varchar(120) NOT NULL DEFAULT '',
	`region` varchar(120) NOT NULL DEFAULT '',
	`postal_code` varchar(30) NOT NULL DEFAULT '',
	`country` varchar(80) NOT NULL DEFAULT '',
	`notes` text NOT NULL,
	`shipping_method` varchar(120) NOT NULL DEFAULT '',
	`shipping_eta` varchar(80) NOT NULL DEFAULT '',
	`payment_method` varchar(120) NOT NULL DEFAULT '',
	`payment_instructions` text NOT NULL,
	`payment_requires_proof` boolean NOT NULL DEFAULT false,
	`payment_proof_url` varchar(600) NOT NULL DEFAULT '',
	`coupon_code` varchar(40) NOT NULL DEFAULT '',
	`subtotal` bigint NOT NULL,
	`discount` bigint NOT NULL DEFAULT 0,
	`shipping_cost` bigint NOT NULL DEFAULT 0,
	`total` bigint NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`tracking_number` varchar(120) NOT NULL DEFAULT '',
	`tracking_url` varchar(400) NOT NULL DEFAULT '',
	`admin_notes` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_idx` UNIQUE(`number`),
	CONSTRAINT `orders_token_idx` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`intro` varchar(400) NOT NULL DEFAULT '',
	`blocks` mediumtext NOT NULL,
	`show_in_nav` boolean NOT NULL DEFAULT false,
	`show_in_footer` boolean NOT NULL DEFAULT true,
	`is_published` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`seo_description` varchar(300) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300) NOT NULL DEFAULT '',
	`instructions` text NOT NULL,
	`requires_proof` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`url` varchar(600) NOT NULL,
	`color` varchar(40) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`color` varchar(40) NOT NULL DEFAULT '',
	`size` varchar(40) NOT NULL DEFAULT '',
	`sku` varchar(80) NOT NULL DEFAULT '',
	`stock` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`tagline` varchar(200) NOT NULL DEFAULT '',
	`description` text NOT NULL,
	`details` text NOT NULL,
	`price` bigint NOT NULL,
	`compare_at_price` bigint,
	`category_id` int,
	`colors` text NOT NULL,
	`sizes` text NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_featured` boolean NOT NULL DEFAULT false,
	`featured_order` int NOT NULL DEFAULT 0,
	`is_new` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(64) NOT NULL,
	`value` mediumtext NOT NULL,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `shipping_methods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300) NOT NULL DEFAULT '',
	`eta` varchar(80) NOT NULL DEFAULT '',
	`price` bigint NOT NULL DEFAULT 0,
	`free_over` bigint,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `shipping_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(120) NOT NULL DEFAULT '',
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);