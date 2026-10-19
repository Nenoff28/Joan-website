ALTER TABLE `promotion_campaign_products` ADD `discountPercent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `promotion_campaign_products` ADD `fixedPriceEur` decimal(10,2);--> statement-breakpoint
ALTER TABLE `promotion_campaign_products` ADD `startsAt` timestamp;--> statement-breakpoint
ALTER TABLE `promotion_campaign_products` ADD `endsAt` timestamp;--> statement-breakpoint
ALTER TABLE `promotion_campaigns` ADD `fixedPriceEur` decimal(10,2);