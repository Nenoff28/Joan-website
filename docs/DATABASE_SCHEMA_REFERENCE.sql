-- Joan.bg production schema reference
-- Generated without data; review against drizzle/schema.ts before applying migrations.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `admin_activities`;
CREATE TABLE `admin_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adminUserId` int NOT NULL,
  `action` varchar(96) NOT NULL,
  `entityType` varchar(64) NOT NULL,
  `entityId` int DEFAULT NULL,
  `metadataJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `admin_activities_adminUserId_users_id_fk` (`adminUserId`),
  KEY `admin_activities_created_idx` (`createdAt`),
  CONSTRAINT `admin_activities_adminUserId_users_id_fk` FOREIGN KEY (`adminUserId`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=300001;

DROP TABLE IF EXISTS `catalogue_brochures`;
CREATE TABLE `catalogue_brochures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `sourcePdfKey` text DEFAULT NULL,
  `sourcePdfUrl` text DEFAULT NULL,
  `pageUrlsJson` text NOT NULL,
  `pageCount` int NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '0',
  `isArchived` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `brochures_active_archived_idx` (`isActive`,`isArchived`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=150001;

DROP TABLE IF EXISTS `catalogue_categories`;
CREATE TABLE `catalogue_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(128) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `imageUrl` text NOT NULL,
  `icon` varchar(64) NOT NULL,
  `subcategoriesJson` text NOT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `legacyCategoryId` int DEFAULT NULL,
  `legacyParentCategoryId` int DEFAULT NULL,
  `legacySeoKeywordBg` varchar(255) DEFAULT NULL,
  `legacySeoKeywordEn` varchar(255) DEFAULT NULL,
  `legacyMetaTitleBg` varchar(500) DEFAULT NULL,
  `legacyMetaTitleEn` varchar(500) DEFAULT NULL,
  `legacyMetaDescriptionBg` text DEFAULT NULL,
  `legacyMetaDescriptionEn` text DEFAULT NULL,
  `legacyCanonicalUrl` text DEFAULT NULL,
  `legacyMetaRobots` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `catalogue_categories_slug_unique` (`slug`),
  UNIQUE KEY `catalogue_categories_legacyCategoryId_unique` (`legacyCategoryId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=270001;

DROP TABLE IF EXISTS `catalogue_manufacturers`;
CREATE TABLE `catalogue_manufacturers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `legacyManufacturerId` int NOT NULL,
  `slug` varchar(160) NOT NULL,
  `name` varchar(255) NOT NULL,
  `nameEn` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `imageUrl` text DEFAULT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `importedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `catalogue_manufacturers_legacyManufacturerId_unique` (`legacyManufacturerId`),
  UNIQUE KEY `catalogue_manufacturers_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=240001;

DROP TABLE IF EXISTS `catalogue_product_category_links`;
CREATE TABLE `catalogue_product_category_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `productId` int NOT NULL,
  `categoryId` int NOT NULL,
  `position` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `cpc_link_product_fk` (`productId`),
  KEY `cpc_link_category_fk` (`categoryId`),
  KEY `catalogue_product_category_links_product_idx` (`productId`),
  KEY `catalogue_product_category_links_category_idx` (`categoryId`),
  CONSTRAINT `cpc_link_product_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `cpc_link_category_fk` FOREIGN KEY (`categoryId`) REFERENCES `catalogue_categories` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=806754;

DROP TABLE IF EXISTS `catalogue_products`;
CREATE TABLE `catalogue_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `categoryId` int NOT NULL,
  `slug` varchar(160) NOT NULL,
  `sku` varchar(96) DEFAULT NULL,
  `brand` varchar(160) DEFAULT NULL,
  `name` varchar(500) NOT NULL,
  `description` text NOT NULL,
  `imageUrl` text NOT NULL,
  `galleryJson` text NOT NULL,
  `imageAlt` text NOT NULL,
  `priceEur` decimal(10,2) DEFAULT NULL,
  `oldPriceEur` decimal(10,2) DEFAULT NULL,
  `discountLabel` varchar(48) DEFAULT NULL,
  `availability` enum('in_stock','on_request','out_of_stock') NOT NULL DEFAULT 'on_request',
  `stockQuantity` int NOT NULL DEFAULT '0',
  `featuresJson` text NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `legacyProductId` int DEFAULT NULL,
  `legacyManufacturerId` int DEFAULT NULL,
  `legacySeoKeywordBg` varchar(255) DEFAULT NULL,
  `legacySeoKeywordEn` varchar(255) DEFAULT NULL,
  `legacyMetaTitleBg` varchar(500) DEFAULT NULL,
  `legacyMetaTitleEn` varchar(500) DEFAULT NULL,
  `legacyMetaDescriptionBg` text DEFAULT NULL,
  `legacyMetaDescriptionEn` text DEFAULT NULL,
  `legacyCanonicalUrl` text DEFAULT NULL,
  `legacyMetaRobots` varchar(255) DEFAULT NULL,
  `legacyPublicSlug` varchar(160) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `catalogue_products_slug_unique` (`slug`),
  KEY `catalogue_products_categoryId_catalogue_categories_id_fk` (`categoryId`),
  KEY `products_category_active_idx` (`categoryId`,`isActive`),
  UNIQUE KEY `catalogue_products_legacyProductId_unique` (`legacyProductId`),
  KEY `products_active_updated_idx` (`isActive`,`updatedAt`),
  UNIQUE KEY `catalogue_products_legacyPublicSlug_unique` (`legacyPublicSlug`),
  CONSTRAINT `catalogue_products_categoryId_catalogue_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `catalogue_categories` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=300001;

DROP TABLE IF EXISTS `contact_enquiries`;
CREATE TABLE `contact_enquiries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `referenceNumber` varchar(32) NOT NULL,
  `fullName` varchar(255) NOT NULL,
  `email` varchar(320) NOT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `subject` varchar(160) NOT NULL,
  `message` text NOT NULL,
  `status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  `adminNote` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `contact_enquiries_referenceNumber_unique` (`referenceNumber`),
  KEY `contact_enquiries_status_created_idx` (`status`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=150001;

DROP TABLE IF EXISTS `customer_activation_tokens`;
CREATE TABLE `customer_activation_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customerId` int NOT NULL,
  `purpose` enum('activation','password_reset') NOT NULL,
  `tokenHash` varchar(128) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `customer_activation_tokens_tokenHash_unique` (`tokenHash`),
  KEY `customer_activation_tokens_customerId_customer_profiles_id_fk` (`customerId`),
  KEY `customer_activation_tokens_lookup_idx` (`customerId`,`purpose`,`expiresAt`),
  CONSTRAINT `customer_activation_tokens_customerId_customer_profiles_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

DROP TABLE IF EXISTS `customer_addresses`;
CREATE TABLE `customer_addresses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customerId` int NOT NULL,
  `legacyPosition` int NOT NULL,
  `firstName` varchar(160) NOT NULL,
  `lastName` varchar(160) NOT NULL,
  `company` varchar(255) DEFAULT NULL,
  `addressLine1` varchar(512) NOT NULL,
  `addressLine2` varchar(512) DEFAULT NULL,
  `city` varchar(160) NOT NULL,
  `postcode` varchar(32) DEFAULT NULL,
  `zone` varchar(160) DEFAULT NULL,
  `country` varchar(160) DEFAULT NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT '0',
  `importedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `customer_addresses_customerId_customer_profiles_id_fk` (`customerId`),
  KEY `customer_addresses_customer_idx` (`customerId`),
  CONSTRAINT `customer_addresses_customerId_customer_profiles_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=240001;

DROP TABLE IF EXISTS `customer_credentials`;
CREATE TABLE `customer_credentials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customerId` int NOT NULL,
  `passwordHash` varchar(255) DEFAULT NULL,
  `passwordSetAt` timestamp NULL DEFAULT NULL,
  `sessionVersion` int NOT NULL DEFAULT '1',
  `failedLoginCount` int NOT NULL DEFAULT '0',
  `lockedUntil` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `customer_credentials_customerId_unique` (`customerId`),
  CONSTRAINT `customer_credentials_customerId_customer_profiles_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=90001;

DROP TABLE IF EXISTS `customer_profiles`;
CREATE TABLE `customer_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `legacyCustomerId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `firstName` varchar(160) NOT NULL,
  `lastName` varchar(160) NOT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `newsletterSubscribed` tinyint(1) NOT NULL DEFAULT '0',
  `legacyWasApproved` tinyint(1) NOT NULL DEFAULT '0',
  `legacyWasActive` tinyint(1) NOT NULL DEFAULT '0',
  `accountStatus` enum('pending_activation','active','disabled') NOT NULL DEFAULT 'pending_activation',
  `importedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `activatedAt` timestamp NULL DEFAULT NULL,
  `lastSignedInAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `customer_profiles_legacyCustomerId_unique` (`legacyCustomerId`),
  UNIQUE KEY `customer_profiles_email_unique` (`email`),
  KEY `customer_profiles_status_idx` (`accountStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=90001;

DROP TABLE IF EXISTS `legacy_customer_order_lines`;
CREATE TABLE `legacy_customer_order_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `legacyOrderRecordId` int NOT NULL,
  `legacyProductId` int DEFAULT NULL,
  `linePosition` int NOT NULL,
  `productName` varchar(500) NOT NULL,
  `productModel` varchar(160) DEFAULT NULL,
  `quantity` int NOT NULL,
  `unitPrice` decimal(14,2) NOT NULL,
  `lineTotal` decimal(14,2) NOT NULL,
  `lineTax` decimal(14,2) DEFAULT NULL,
  `importedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `lc_order_line_order_fk` (`legacyOrderRecordId`),
  KEY `legacy_customer_order_lines_order_idx` (`legacyOrderRecordId`),
  CONSTRAINT `lc_order_line_order_fk` FOREIGN KEY (`legacyOrderRecordId`) REFERENCES `legacy_customer_orders` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=210001;

DROP TABLE IF EXISTS `legacy_customer_orders`;
CREATE TABLE `legacy_customer_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `legacyOrderId` int NOT NULL,
  `customerId` int DEFAULT NULL,
  `legacyCustomerId` int DEFAULT NULL,
  `storeName` varchar(255) DEFAULT NULL,
  `orderStatus` varchar(160) NOT NULL,
  `currencyCode` varchar(8) NOT NULL,
  `currencyValue` decimal(16,8) NOT NULL,
  `total` decimal(14,2) NOT NULL,
  `totalInOrderCurrency` decimal(14,2) DEFAULT NULL,
  `orderedAt` timestamp NOT NULL,
  `legacyModifiedAt` timestamp NULL DEFAULT NULL,
  `importedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `legacy_customer_orders_legacyOrderId_unique` (`legacyOrderId`),
  KEY `lc_order_customer_fk` (`customerId`),
  KEY `legacy_customer_orders_customer_date_idx` (`customerId`,`orderedAt`),
  KEY `legacy_customer_orders_status_idx` (`orderStatus`),
  CONSTRAINT `lc_order_customer_fk` FOREIGN KEY (`customerId`) REFERENCES `customer_profiles` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

DROP TABLE IF EXISTS `order_requests`;
CREATE TABLE `order_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requestNumber` varchar(32) NOT NULL,
  `productId` int DEFAULT NULL,
  `productName` varchar(500) NOT NULL,
  `productSku` varchar(96) DEFAULT NULL,
  `productImageUrl` text NOT NULL,
  `quantity` int NOT NULL,
  `priceEur` decimal(10,2) DEFAULT NULL,
  `totalEur` decimal(10,2) DEFAULT NULL,
  `fullName` varchar(255) NOT NULL,
  `email` varchar(320) NOT NULL,
  `phone` varchar(64) NOT NULL,
  `address` text NOT NULL,
  `city` varchar(160) NOT NULL,
  `postcode` varchar(20) NOT NULL,
  `status` enum('new','contacted','confirmed','closed','cancelled') NOT NULL DEFAULT 'new',
  `adminNote` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `order_requests_requestNumber_unique` (`requestNumber`),
  KEY `order_requests_productId_catalogue_products_id_fk` (`productId`),
  KEY `order_requests_status_created_idx` (`status`,`createdAt`),
  CONSTRAINT `order_requests_productId_catalogue_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalogue_products` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `name` text DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `loginMethod` varchar(64) DEFAULT NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `users_openId_unique` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=15960001;

SET FOREIGN_KEY_CHECKS=1;
