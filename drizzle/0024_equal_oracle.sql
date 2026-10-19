CREATE TABLE `promotion_campaign_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promotion_campaign_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotion_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`discountPercent` decimal(5,2) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotion_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `promotion_campaign_products` ADD CONSTRAINT `promotion_campaign_products_campaignId_promotion_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `promotion_campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_campaign_products` ADD CONSTRAINT `promotion_campaign_products_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_campaigns` ADD CONSTRAINT `promotion_campaigns_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `promotion_campaign_products_campaign_idx` ON `promotion_campaign_products` (`campaignId`);--> statement-breakpoint
CREATE INDEX `promotion_campaign_products_product_idx` ON `promotion_campaign_products` (`productId`);--> statement-breakpoint
CREATE INDEX `promotion_campaigns_schedule_idx` ON `promotion_campaigns` (`isActive`,`startsAt`,`endsAt`);