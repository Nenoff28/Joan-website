ALTER TABLE `ai_content_settings` MODIFY COLUMN `dailyGenerationLimit` int NOT NULL DEFAULT 20;--> statement-breakpoint
ALTER TABLE `ai_content_settings` ADD `model` varchar(160) DEFAULT 'gemini-3.8-flash' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalogue_product_ai_content` ADD `aiProvider` varchar(32);--> statement-breakpoint
ALTER TABLE `catalogue_product_ai_content` ADD `aiModel` varchar(160);--> statement-breakpoint
ALTER TABLE `catalogue_product_ai_content` ADD `aiInputTokens` int;--> statement-breakpoint
ALTER TABLE `catalogue_product_ai_content` ADD `aiOutputTokens` int;--> statement-breakpoint
ALTER TABLE `catalogue_product_ai_content` ADD `aiSearchCount` int DEFAULT 0;