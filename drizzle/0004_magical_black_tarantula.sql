CREATE TABLE `meta_accounts` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_ad_daily_facts` (
	`accountId` varchar(64) NOT NULL,
	`campaignId` varchar(64) NOT NULL,
	`adsetId` varchar(64) NOT NULL,
	`adId` varchar(64) NOT NULL,
	`date` varchar(16) NOT NULL,
	`amountSpent` decimal(12,2) NOT NULL,
	`impressions` int NOT NULL,
	`reach` int NOT NULL,
	`frequency` decimal(8,4) NOT NULL,
	`clicksAll` int NOT NULL,
	`linkClicks` int NOT NULL,
	`ctrAll` decimal(8,4) NOT NULL,
	`ctrLink` decimal(8,4) NOT NULL,
	`cpm` decimal(10,4) NOT NULL,
	`cpcAll` decimal(10,4) NOT NULL,
	`cpcLink` decimal(10,4) NOT NULL,
	`leads` int NOT NULL,
	`costPerLead` decimal(10,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_ad_daily_facts_accountId_adId_date_pk` PRIMARY KEY(`accountId`,`adId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `meta_ads` (
	`id` varchar(64) NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`campaignId` varchar(64) NOT NULL,
	`adsetId` varchar(64) NOT NULL,
	`name` text NOT NULL,
	`status` varchar(64),
	`effectiveStatus` varchar(64),
	`creativeId` varchar(64),
	`creativeName` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_adset_daily_facts` (
	`accountId` varchar(64) NOT NULL,
	`campaignId` varchar(64) NOT NULL,
	`adsetId` varchar(64) NOT NULL,
	`date` varchar(16) NOT NULL,
	`amountSpent` decimal(12,2) NOT NULL,
	`impressions` int NOT NULL,
	`reach` int NOT NULL,
	`frequency` decimal(8,4) NOT NULL,
	`clicksAll` int NOT NULL,
	`linkClicks` int NOT NULL,
	`ctrAll` decimal(8,4) NOT NULL,
	`ctrLink` decimal(8,4) NOT NULL,
	`cpm` decimal(10,4) NOT NULL,
	`cpcAll` decimal(10,4) NOT NULL,
	`cpcLink` decimal(10,4) NOT NULL,
	`leads` int NOT NULL,
	`costPerLead` decimal(10,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_adset_daily_facts_accountId_adsetId_date_pk` PRIMARY KEY(`accountId`,`adsetId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `meta_adsets` (
	`id` varchar(64) NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`campaignId` varchar(64) NOT NULL,
	`name` text NOT NULL,
	`status` varchar(64),
	`effectiveStatus` varchar(64),
	`optimizationGoal` varchar(64),
	`billingEvent` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_adsets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_campaign_daily_facts` (
	`accountId` varchar(64) NOT NULL,
	`campaignId` varchar(64) NOT NULL,
	`date` varchar(16) NOT NULL,
	`amountSpent` decimal(12,2) NOT NULL,
	`impressions` int NOT NULL,
	`reach` int NOT NULL,
	`frequency` decimal(8,4) NOT NULL,
	`clicksAll` int NOT NULL,
	`linkClicks` int NOT NULL,
	`ctrAll` decimal(8,4) NOT NULL,
	`ctrLink` decimal(8,4) NOT NULL,
	`cpm` decimal(10,4) NOT NULL,
	`cpcAll` decimal(10,4) NOT NULL,
	`cpcLink` decimal(10,4) NOT NULL,
	`leads` int NOT NULL,
	`costPerLead` decimal(10,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_campaign_daily_facts_accountId_campaignId_date_pk` PRIMARY KEY(`accountId`,`campaignId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `meta_campaigns` (
	`id` varchar(64) NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`name` text NOT NULL,
	`shortName` varchar(128) NOT NULL,
	`objective` varchar(64) NOT NULL,
	`status` varchar(64),
	`effectiveStatus` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_campaigns_id` PRIMARY KEY(`id`)
);
