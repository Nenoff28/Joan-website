CREATE TABLE `contact_enquiry_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactEnquiryId` int NOT NULL,
	`status` enum('new','contacted','closed') NOT NULL,
	`comment` text,
	`authorId` int,
	`authorName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_enquiry_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contact_enquiry_history` ADD CONSTRAINT `contact_enquiry_history_contactEnquiryId_contact_enquiries_id_fk` FOREIGN KEY (`contactEnquiryId`) REFERENCES `contact_enquiries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_enquiry_history` ADD CONSTRAINT `contact_enquiry_history_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contact_enquiry_history_enquiry_created_idx` ON `contact_enquiry_history` (`contactEnquiryId`,`createdAt`);
--> statement-breakpoint
INSERT INTO `contact_enquiry_history` (`contactEnquiryId`, `status`, `comment`, `authorId`, `authorName`, `createdAt`)
SELECT ce.`id`, ce.`status`, NULLIF(TRIM(ce.`adminNote`), ''), NULL, 'Системен импорт', ce.`createdAt`
FROM `contact_enquiries` ce
WHERE NOT EXISTS (SELECT 1 FROM `contact_enquiry_history` h WHERE h.`contactEnquiryId` = ce.`id`);
