CREATE TABLE IF NOT EXISTS `daily_performance` (
	`date` varchar(16) NOT NULL,
	`label` varchar(32) NOT NULL,
	`amountSpent` decimal(12,2) NOT NULL,
	`leads` int NOT NULL,
	`costPerLead` decimal(8,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_performance_date` PRIMARY KEY(`date`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `refresh_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trigger` enum('manual','scheduled') NOT NULL,
	`status` enum('started','success','failed') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`savedPresets` text,
	`failedPresets` text,
	`errorMessage` text,
	`accountId` varchar(64),
	CONSTRAINT `refresh_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaigns` MODIFY COLUMN `objective` enum('FEGLI Trap','Annuity','FEGLI Conversion','Other') NOT NULL;
