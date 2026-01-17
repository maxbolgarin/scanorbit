-- Remove redundant/unused columns from audit_logs table
-- org_id: can be derived from user_id via user_org_members
-- resource, resource_id: can be parsed from path
-- details: rarely used, removed to simplify

DROP INDEX IF EXISTS "audit_logs_org_id_idx";
DROP INDEX IF EXISTS "audit_logs_resource_idx";

ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "resource";
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "resource_id";
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "details";
