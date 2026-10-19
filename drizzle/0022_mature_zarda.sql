ALTER TABLE `order_requests` ADD `invoiceRequested` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceCompanyName` varchar(255);--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceEik` varchar(32);--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceVatNumber` varchar(32);--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceMol` varchar(255);--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceCity` varchar(160);--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoicePostcode` varchar(20);--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceAddress` text;--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceAddressAdditional` text;--> statement-breakpoint
ALTER TABLE `order_requests` ADD `invoiceAdditionalInfo` text;