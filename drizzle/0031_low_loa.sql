CREATE TABLE `catalogue_product_ai_backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`description` text NOT NULL,
	`featuresJson` text NOT NULL,
	`seoTitle` varchar(500),
	`seoDescription` text,
	`keywords` varchar(255),
	`backedUpAt` timestamp NOT NULL DEFAULT (now()),
	`restoredAt` timestamp,
	CONSTRAINT `catalogue_product_ai_backups_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_product_ai_backups_productId_unique` UNIQUE(`productId`)
);
--> statement-breakpoint
ALTER TABLE `catalogue_product_ai_backups` ADD CONSTRAINT `catalogue_product_ai_backups_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_ai_backup_product_idx` ON `catalogue_product_ai_backups` (`productId`);