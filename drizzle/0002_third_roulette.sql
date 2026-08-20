CREATE TABLE `contact_enquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceNumber` varchar(32) NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(64),
	`subject` varchar(160) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_enquiries_id` PRIMARY KEY(`id`),
	CONSTRAINT `contact_enquiries_referenceNumber_unique` UNIQUE(`referenceNumber`)
);
--> statement-breakpoint
CREATE INDEX `contact_enquiries_status_created_idx` ON `contact_enquiries` (`status`,`createdAt`);