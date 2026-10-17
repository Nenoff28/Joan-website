CREATE TABLE `order_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderRequestId` int NOT NULL,
	`status` enum('new','contacted','confirmed','closed','cancelled') NOT NULL,
	`comment` text,
	`authorId` int,
	`authorName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_request_items` ADD `parametersJson` text;--> statement-breakpoint
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_orderRequestId_order_requests_id_fk` FOREIGN KEY (`orderRequestId`) REFERENCES `order_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_status_history_request_created_idx` ON `order_status_history` (`orderRequestId`,`createdAt`);
--> statement-breakpoint
UPDATE `order_request_items` i LEFT JOIN `catalogue_products` p ON i.`productId` = p.`id` SET i.`parametersJson` = CASE WHEN p.`featuresJson` IS NULL THEN NULL ELSE p.`featuresJson` END WHERE i.`parametersJson` IS NULL;
--> statement-breakpoint
INSERT INTO `order_status_history` (`orderRequestId`, `status`, `comment`, `authorId`, `authorName`, `createdAt`) SELECT `id`, `status`, NULLIF(TRIM(`adminNote`), ''), NULL, 'Система · миграция', `createdAt` FROM `order_requests`;
