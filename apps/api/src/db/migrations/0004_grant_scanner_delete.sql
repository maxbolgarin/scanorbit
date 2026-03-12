-- so_scanner: grant DELETE on tables where scanner removes stale data
GRANT DELETE ON resources, resource_dependencies TO so_scanner;
--> statement-breakpoint
-- so_analyzer: grant SELECT on tables needed for orphan and SSL analysis
GRANT SELECT ON resource_dependencies, certificates TO so_analyzer;
--> statement-breakpoint
-- so_analyzer: grant UPDATE on scans so analyzer can mark scan as complete
GRANT UPDATE ON scans TO so_analyzer;
--> statement-breakpoint
-- so_analyzer: grant INSERT on dead_letter_jobs so failed jobs can be stored
GRANT SELECT, INSERT ON dead_letter_jobs TO so_analyzer;
