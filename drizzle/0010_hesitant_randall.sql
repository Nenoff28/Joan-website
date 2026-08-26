CREATE TABLE `catalogue_category_english` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`subcategoriesJson` text NOT NULL,
	`seoKeywords` varchar(255),
	`seoTitle` varchar(500),
	`seoDescription` text,
	`sourceContentHash` varchar(64) NOT NULL,
	`translatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogue_category_english_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_category_english_categoryId_unique` UNIQUE(`categoryId`)
);
--> statement-breakpoint
CREATE TABLE `catalogue_product_english` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`imageAlt` text NOT NULL,
	`featuresJson` text NOT NULL,
	`seoKeywords` varchar(255),
	`seoTitle` varchar(500),
	`seoDescription` text,
	`sourceContentHash` varchar(64) NOT NULL,
	`translatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogue_product_english_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_product_english_productId_unique` UNIQUE(`productId`)
);
--> statement-breakpoint
ALTER TABLE `catalogue_category_english` ADD CONSTRAINT `catalogue_category_english_categoryId_catalogue_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `catalogue_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalogue_product_english` ADD CONSTRAINT `catalogue_product_english_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;