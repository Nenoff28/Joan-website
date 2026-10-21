CREATE TABLE `ai_generation_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('queued','running','paused','completed','failed') NOT NULL DEFAULT 'queued',
	`totalJobs` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_generation_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_generation_daily_usage` (
	`usageDate` varchar(10) NOT NULL,
	`generatedCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_generation_daily_usage_usageDate` PRIMARY KEY(`usageDate`)
);
--> statement-breakpoint
CREATE TABLE `ai_generation_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`productId` int NOT NULL,
	`status` enum('queued','running','succeeded','failed') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`lastError` text,
	`nextAttemptAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_generation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_content_settings` ADD `dailyGenerationLimit` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_generation_batches` ADD CONSTRAINT `ai_generation_batches_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_generation_jobs` ADD CONSTRAINT `ai_generation_jobs_batchId_ai_generation_batches_id_fk` FOREIGN KEY (`batchId`) REFERENCES `ai_generation_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_generation_jobs` ADD CONSTRAINT `ai_generation_jobs_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_generation_batches_status_idx` ON `ai_generation_batches` (`status`);--> statement-breakpoint
CREATE INDEX `ai_generation_jobs_batch_idx` ON `ai_generation_jobs` (`batchId`,`status`);--> statement-breakpoint
CREATE INDEX `ai_generation_jobs_retry_idx` ON `ai_generation_jobs` (`status`,`nextAttemptAt`);