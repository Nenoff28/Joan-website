CREATE TABLE `catalogue_product_ai_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`aiStatus` enum('pending','generated','reviewed','published','error') NOT NULL DEFAULT 'pending',
	`aiDescription` text,
	`aiFeatures` text,
	`aiSeoTitle` varchar(500),
	`aiSeoDescription` text,
	`aiKeywords` varchar(1000),
	`aiSourceUrls` text,
	`aiConfidence` enum('high','low'),
	`aiError` text,
	`aiGeneratedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogue_product_ai_content_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalogue_product_ai_content_productId_unique` UNIQUE(`productId`)
);
--> statement-breakpoint
ALTER TABLE `catalogue_product_ai_content` ADD CONSTRAINT `catalogue_product_ai_content_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_ai_status_idx` ON `catalogue_product_ai_content` (`aiStatus`);

--> statement-breakpoint
INSERT INTO `catalogue_product_ai_content` (`productId`, `aiStatus`)
SELECT `id`, 'pending' FROM `catalogue_products`;
