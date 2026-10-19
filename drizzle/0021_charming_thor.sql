ALTER TABLE `contact_enquiries` ADD `isDeleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `order_requests` ADD `isDeleted` boolean DEFAULT false NOT NULL;