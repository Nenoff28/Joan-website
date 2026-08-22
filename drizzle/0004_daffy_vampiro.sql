CREATE TABLE `legacy_customer_order_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legacyOrderRecordId` int NOT NULL,
	`legacyProductId` int,
	`linePosition` int NOT NULL,
	`productName` varchar(500) NOT NULL,
	`productModel` varchar(160),
	`quantity` int NOT NULL,
	`unitPrice` decimal(14,2) NOT NULL,
	`lineTotal` decimal(14,2) NOT NULL,
	`lineTax` decimal(14,2),
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legacy_customer_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legacy_customer_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legacyOrderId` int NOT NULL,
	`customerId` int,
	`legacyCustomerId` int,
	`storeName` varchar(255),
	`orderStatus` varchar(160) NOT NULL,
	`currencyCode` varchar(8) NOT NULL,
	`currencyValue` decimal(16,8) NOT NULL,
	`total` decimal(14,2) NOT NULL,
	`totalInOrderCurrency` decimal(14,2),
	`orderedAt` timestamp NOT NULL,
	`legacyModifiedAt` timestamp,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legacy_customer_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `legacy_customer_orders_legacyOrderId_unique` UNIQUE(`legacyOrderId`)
);
--> statement-breakpoint
ALTER TABLE `legacy_customer_order_lines` ADD CONSTRAINT `lc_order_line_order_fk` FOREIGN KEY (`legacyOrderRecordId`) REFERENCES `legacy_customer_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legacy_customer_orders` ADD CONSTRAINT `lc_order_customer_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `legacy_customer_order_lines_order_idx` ON `legacy_customer_order_lines` (`legacyOrderRecordId`);--> statement-breakpoint
CREATE INDEX `legacy_customer_orders_customer_date_idx` ON `legacy_customer_orders` (`customerId`,`orderedAt`);--> statement-breakpoint
CREATE INDEX `legacy_customer_orders_status_idx` ON `legacy_customer_orders` (`orderStatus`);
