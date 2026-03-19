CREATE TABLE `account_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportDateRange` varchar(64) NOT NULL,
	`accountName` varchar(128) NOT NULL,
	`accountCurrency` varchar(8) NOT NULL DEFAULT 'USD',
	`amountSpent` decimal(12,2) NOT NULL,
	`impressions` int NOT NULL,
	`reach` int NOT NULL,
	`frequency` decimal(6,2) NOT NULL,
	`clicksAll` int NOT NULL,
	`linkClicks` int NOT NULL,
	`ctrAll` decimal(6,2) NOT NULL,
	`ctrLink` decimal(6,2) NOT NULL,
	`cpm` decimal(8,2) NOT NULL,
	`cpcAll` decimal(8,4) NOT NULL,
	`cpcLink` decimal(8,4) NOT NULL,
	`leads` int NOT NULL,
	`costPerLead` decimal(8,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `action_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`priority` enum('critical','high','medium') NOT NULL,
	`category` enum('pause','scale','optimize','test') NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text NOT NULL,
	`estimatedImpact` text NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `action_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` varchar(32) NOT NULL,
	`name` text NOT NULL,
	`shortName` varchar(128) NOT NULL,
	`objective` enum('FEGLI Trap','Annuity','FEGLI Conversion') NOT NULL,
	`amountSpent` decimal(12,2) NOT NULL,
	`impressions` int NOT NULL,
	`reach` int NOT NULL,
	`frequency` decimal(6,2) NOT NULL,
	`clicksAll` int NOT NULL,
	`linkClicks` int NOT NULL,
	`ctrAll` decimal(6,2) NOT NULL,
	`ctrLink` decimal(6,2) NOT NULL,
	`cpm` decimal(8,2) NOT NULL,
	`cpcAll` decimal(8,4) NOT NULL,
	`cpcLink` decimal(8,4) NOT NULL,
	`leads` int NOT NULL,
	`costPerLead` decimal(8,2),
	`status` enum('excellent','moderate','poor') NOT NULL,
	`recommendation` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`settingKey` varchar(64) NOT NULL,
	`settingValue` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`)
);
