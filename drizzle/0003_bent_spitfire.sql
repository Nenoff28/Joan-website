CREATE TABLE `customer_activation_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`purpose` enum('activation','password_reset') NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_activation_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_activation_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`legacyPosition` int NOT NULL,
	`firstName` varchar(160) NOT NULL,
	`lastName` varchar(160) NOT NULL,
	`company` varchar(255),
	`addressLine1` varchar(512) NOT NULL,
	`addressLine2` varchar(512),
	`city` varchar(160) NOT NULL,
	`postcode` varchar(32),
	`zone` varchar(160),
	`country` varchar(160),
	`isDefault` boolean NOT NULL DEFAULT false,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`passwordHash` varchar(255),
	`passwordSetAt` timestamp,
	`sessionVersion` int NOT NULL DEFAULT 1,
	`failedLoginCount` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_credentials_customerId_unique` UNIQUE(`customerId`)
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legacyCustomerId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`firstName` varchar(160) NOT NULL,
	`lastName` varchar(160) NOT NULL,
	`phone` varchar(64),
	`newsletterSubscribed` boolean NOT NULL DEFAULT false,
	`legacyWasApproved` boolean NOT NULL DEFAULT false,
	`legacyWasActive` boolean NOT NULL DEFAULT false,
	`accountStatus` enum('pending_activation','active','disabled') NOT NULL DEFAULT 'pending_activation',
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`activatedAt` timestamp,
	`lastSignedInAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_profiles_legacyCustomerId_unique` UNIQUE(`legacyCustomerId`),
	CONSTRAINT `customer_profiles_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `customer_activation_tokens` ADD CONSTRAINT `customer_activation_tokens_customerId_customer_profiles_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_customerId_customer_profiles_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_credentials` ADD CONSTRAINT `customer_credentials_customerId_customer_profiles_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_activation_tokens_lookup_idx` ON `customer_activation_tokens` (`customerId`,`purpose`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `customer_addresses_customer_idx` ON `customer_addresses` (`customerId`);--> statement-breakpoint
CREATE INDEX `customer_profiles_status_idx` ON `customer_profiles` (`accountStatus`);