CREATE TABLE `access_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`permissionsJson` text NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `access_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `access_roles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `customer_google_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`subject` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_google_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_google_identities_customerId_unique` UNIQUE(`customerId`),
	CONSTRAINT `customer_google_identities_subject_unique` UNIQUE(`subject`)
);
--> statement-breakpoint
ALTER TABLE `customer_profiles` MODIFY COLUMN `legacyCustomerId` int;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `accessRoleId` int;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `staffUserId` int;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_staffUserId_unique` UNIQUE(`staffUserId`);--> statement-breakpoint
ALTER TABLE `customer_google_identities` ADD CONSTRAINT `customer_google_identities_customerId_customer_profiles_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_accessRoleId_access_roles_id_fk` FOREIGN KEY (`accessRoleId`) REFERENCES `access_roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_staffUserId_users_id_fk` FOREIGN KEY (`staffUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `access_roles` (`slug`,`name`,`description`,`permissionsJson`,`isSystem`) VALUES ('customer','Клиент','Клиентски профил без административен достъп.','[]',true);
--> statement-breakpoint
INSERT INTO `access_roles` (`slug`,`name`,`description`,`permissionsJson`,`isSystem`) VALUES ('operator','Оператор','Обработка на поръчки и контактни запитвания.','["orders.read","orders.write","enquiries.read","enquiries.write"]',true);
--> statement-breakpoint
INSERT INTO `access_roles` (`slug`,`name`,`description`,`permissionsJson`,`isSystem`) VALUES ('admin','Администратор','Пълен достъп и управление на роли.','["dashboard.read","products.read","products.write","inventory.read","inventory.write","promotions.read","promotions.write","categories.read","categories.write","brochures.read","brochures.write","orders.read","orders.write","enquiries.read","enquiries.write","customers.read","customers.import","legacy_orders.read","legacy_orders.import","activity.read","users.read","users.assign_roles","roles.read","roles.write"]',true);
--> statement-breakpoint
