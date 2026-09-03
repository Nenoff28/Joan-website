CREATE TABLE `order_request_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderRequestId` int NOT NULL,
	`productId` int,
	`productName` varchar(500) NOT NULL,
	`productSku` varchar(96),
	`productImageUrl` text NOT NULL,
	`quantity` int NOT NULL,
	`priceEur` decimal(10,2),
	`totalEur` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_request_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_request_items` ADD CONSTRAINT `order_request_items_orderRequestId_order_requests_id_fk` FOREIGN KEY (`orderRequestId`) REFERENCES `order_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_request_items` ADD CONSTRAINT `order_request_items_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_request_items_request_idx` ON `order_request_items` (`orderRequestId`);--> statement-breakpoint
CREATE INDEX `order_request_items_product_idx` ON `order_request_items` (`productId`);