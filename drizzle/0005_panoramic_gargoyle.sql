CREATE TABLE `catalogue_manufacturers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legacyManufacturerId` int NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`imageUrl` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogue_manufacturers_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_manufacturers_legacyManufacturerId_unique` UNIQUE(`legacyManufacturerId`),
	CONSTRAINT `catalogue_manufacturers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `catalogue_product_category_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`categoryId` int NOT NULL,
	`position` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalogue_product_category_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `catalogue_categories` ADD `legacyCategoryId` int;--> statement-breakpoint
ALTER TABLE `catalogue_categories` ADD `legacyParentCategoryId` int;--> statement-breakpoint
ALTER TABLE `catalogue_products` ADD `legacyProductId` int;--> statement-breakpoint
ALTER TABLE `catalogue_products` ADD `legacyManufacturerId` int;--> statement-breakpoint
ALTER TABLE `catalogue_categories` ADD CONSTRAINT `catalogue_categories_legacyCategoryId_unique` UNIQUE(`legacyCategoryId`);--> statement-breakpoint
ALTER TABLE `catalogue_products` ADD CONSTRAINT `catalogue_products_legacyProductId_unique` UNIQUE(`legacyProductId`);--> statement-breakpoint
ALTER TABLE `catalogue_product_category_links` ADD CONSTRAINT `cpc_link_product_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalogue_product_category_links` ADD CONSTRAINT `cpc_link_category_fk` FOREIGN KEY (`categoryId`) REFERENCES `catalogue_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `catalogue_product_category_links_product_idx` ON `catalogue_product_category_links` (`productId`);--> statement-breakpoint
CREATE INDEX `catalogue_product_category_links_category_idx` ON `catalogue_product_category_links` (`categoryId`);
