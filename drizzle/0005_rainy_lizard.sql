CREATE TABLE `recommendation_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`entityLevel` enum('campaign','adset') NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`actionType` enum('pause','scale','optimize','test') NOT NULL,
	`headline` varchar(255) NOT NULL,
	`rationale` text NOT NULL,
	`confidenceScore` decimal(5,2) NOT NULL,
	`expectedImpact` text NOT NULL,
	`riskNote` text NOT NULL,
	`status` enum('open','accepted','dismissed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recommendation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recommendation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`dateRangeSince` varchar(16) NOT NULL,
	`dateRangeUntil` varchar(16) NOT NULL,
	`sourceMode` enum('live','demo') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recommendation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meta_campaigns` ADD `displayName` varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE `meta_campaigns` ADD `editorCode` varchar(64);--> statement-breakpoint
ALTER TABLE `meta_campaigns` ADD `campaignDescriptor` varchar(191);--> statement-breakpoint
ALTER TABLE `meta_campaigns` ADD `launchLabel` varchar(128);--> statement-breakpoint
ALTER TABLE `meta_campaigns` ADD `audienceDescriptor` varchar(191);