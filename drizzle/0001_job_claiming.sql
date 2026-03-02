ALTER TABLE `jobs` ADD `claimed_by` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `claimed_at` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `lease_expires_at` integer;
