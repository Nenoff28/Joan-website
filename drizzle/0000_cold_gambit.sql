CREATE TABLE `admin_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`action` varchar(96) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`metadataJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `catalogue_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`imageUrl` text NOT NULL,
	`icon` varchar(64) NOT NULL,
	`subcategoriesJson` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogue_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `catalogue_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`slug` varchar(160) NOT NULL,
	`sku` varchar(96),
	`brand` varchar(160),
	`name` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`imageUrl` text NOT NULL,
	`galleryJson` text NOT NULL,
	`imageAlt` text NOT NULL,
	`priceEur` decimal(10,2),
	`priceBgn` decimal(10,2),
	`oldPriceEur` decimal(10,2),
	`oldPriceBgn` decimal(10,2),
	`discountLabel` varchar(48),
	`availability` enum('in_stock','on_request','out_of_stock') NOT NULL DEFAULT 'on_request',
	`stockQuantity` int NOT NULL DEFAULT 0,
	`featuresJson` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogue_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `order_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(32) NOT NULL,
	`productId` int,
	`productName` varchar(500) NOT NULL,
	`productSku` varchar(96),
	`productImageUrl` text NOT NULL,
	`quantity` int NOT NULL,
	`priceEur` decimal(10,2),
	`totalEur` decimal(10,2),
	`fullName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(64) NOT NULL,
	`address` text NOT NULL,
	`city` varchar(160) NOT NULL,
	`postcode` varchar(20) NOT NULL,
	`status` enum('new','contacted','confirmed','closed','cancelled') NOT NULL DEFAULT 'new',
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_requests_requestNumber_unique` UNIQUE(`requestNumber`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `admin_activities` ADD CONSTRAINT `admin_activities_adminUserId_users_id_fk` FOREIGN KEY (`adminUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalogue_products` ADD CONSTRAINT `catalogue_products_categoryId_catalogue_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `catalogue_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_requests` ADD CONSTRAINT `order_requests_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_activities_created_idx` ON `admin_activities` (`createdAt`);--> statement-breakpoint
CREATE INDEX `products_category_active_idx` ON `catalogue_products` (`categoryId`,`isActive`);--> statement-breakpoint
CREATE INDEX `order_requests_status_created_idx` ON `order_requests` (`status`,`createdAt`);