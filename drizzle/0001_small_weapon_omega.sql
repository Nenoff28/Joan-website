CREATE TABLE `catalogue_brochures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`sourcePdfKey` text,
	`sourcePdfUrl` text,
	`pageUrlsJson` text NOT NULL,
	`pageCount` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogue_brochures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `brochures_active_archived_idx` ON `catalogue_brochures` (`isActive`,`isArchived`);