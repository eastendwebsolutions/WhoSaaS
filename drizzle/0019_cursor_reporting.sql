ALTER TABLE "cursor_team_connections" DROP CONSTRAINT IF EXISTS "cursor_team_connections_company_id_unique";--> statement-breakpoint
ALTER TABLE "cursor_team_connections" ADD COLUMN IF NOT EXISTS "account_label" varchar(160) NOT NULL DEFAULT 'Default';--> statement-breakpoint
ALTER TABLE "cursor_team_connections" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "cursor_team_connections" ADD COLUMN IF NOT EXISTS "first_sync_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cursor_team_connections" ADD COLUMN IF NOT EXISTS "api_capabilities_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cursor_team_connections_company_active_idx" ON "cursor_team_connections" ("company_id", "is_active");--> statement-breakpoint
ALTER TABLE "cursor_user_identities" ADD COLUMN IF NOT EXISTS "connection_id" uuid;--> statement-breakpoint
UPDATE "cursor_user_identities" i SET "connection_id" = c.id FROM "cursor_team_connections" c WHERE i."company_id" = c."company_id" AND i."connection_id" IS NULL;--> statement-breakpoint
ALTER TABLE "cursor_user_identities" ALTER COLUMN "connection_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cursor_user_identities" ADD CONSTRAINT "cursor_user_identities_connection_id_cursor_team_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cursor_team_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "cursor_user_identities_company_cursor_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cursor_user_identities_connection_cursor_unique" ON "cursor_user_identities" ("connection_id", "cursor_external_user_id");--> statement-breakpoint
ALTER TABLE "cursor_usage_daily" ADD COLUMN IF NOT EXISTS "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "cursor_usage_daily" ADD CONSTRAINT "cursor_usage_daily_connection_id_cursor_team_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cursor_team_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cursor_account_allowance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"billing_cycle_start" timestamp NOT NULL,
	"billing_cycle_end" timestamp NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"included_spend_cents" numeric(12, 2),
	"on_demand_spend_cents" numeric(12, 2),
	"overall_spend_cents" numeric(12, 2),
	"pool_used_cents" numeric(12, 2),
	"pool_remaining_cents" numeric(12, 2),
	"pool_used_percent" numeric(7, 4),
	"billing_tier" varchar(80),
	"subscription_included_reqs" integer,
	"auto_percent_used" numeric(7, 4),
	"api_percent_used" numeric(7, 4),
	"total_percent_used" numeric(7, 4),
	"allowance_source" varchar(40) DEFAULT 'unknown' NOT NULL,
	"raw_allowance_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cursor_spend_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"cursor_external_user_id" varchar(160) NOT NULL,
	"user_id" uuid,
	"billing_cycle_start" timestamp NOT NULL,
	"billing_cycle_end" timestamp NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"spend_cents" numeric(12, 2) DEFAULT 0 NOT NULL,
	"included_spend_cents" numeric(12, 2),
	"overall_spend_cents" numeric(12, 2),
	"team_pool_share_percent" numeric(7, 4),
	"top_driver_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"billing_tier" varchar(80),
	"auto_percent_used" numeric(7, 4),
	"api_percent_used" numeric(7, 4),
	"total_percent_used" numeric(7, 4),
	"source_email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cursor_feature_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"cursor_external_user_id" varchar(160) NOT NULL,
	"user_id" uuid,
	"usage_date" timestamp NOT NULL,
	"agent_count" integer DEFAULT 0 NOT NULL,
	"tab_count" integer DEFAULT 0 NOT NULL,
	"plan_count" integer DEFAULT 0 NOT NULL,
	"ask_count" integer DEFAULT 0 NOT NULL,
	"skills_count" integer DEFAULT 0 NOT NULL,
	"mcp_count" integer DEFAULT 0 NOT NULL,
	"model_usage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_version_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_endpoint" varchar(80),
	"ingestion_source" varchar(20) DEFAULT 'api' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cursor_coaching_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"rule_key" varchar(80) NOT NULL,
	"category" varchar(60) NOT NULL,
	"severity" varchar(40) NOT NULL,
	"title" varchar(255) NOT NULL,
	"explanation" text NOT NULL,
	"recommended_action" text NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"threshold_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rule_version" varchar(20) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "cursor_account_allowance_snapshots" ADD CONSTRAINT "cursor_account_allowance_snapshots_connection_id_cursor_team_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cursor_team_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_account_allowance_snapshots" ADD CONSTRAINT "cursor_account_allowance_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_spend_snapshots" ADD CONSTRAINT "cursor_spend_snapshots_connection_id_cursor_team_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cursor_team_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_spend_snapshots" ADD CONSTRAINT "cursor_spend_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_spend_snapshots" ADD CONSTRAINT "cursor_spend_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_feature_usage_daily" ADD CONSTRAINT "cursor_feature_usage_daily_connection_id_cursor_team_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cursor_team_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_feature_usage_daily" ADD CONSTRAINT "cursor_feature_usage_daily_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_feature_usage_daily" ADD CONSTRAINT "cursor_feature_usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_coaching_findings" ADD CONSTRAINT "cursor_coaching_findings_connection_id_cursor_team_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cursor_team_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_coaching_findings" ADD CONSTRAINT "cursor_coaching_findings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cursor_coaching_findings" ADD CONSTRAINT "cursor_coaching_findings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cursor_account_allowance_snapshots_connection_cycle_unique" ON "cursor_account_allowance_snapshots" ("connection_id", "billing_cycle_start", "billing_cycle_end", "snapshot_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cursor_spend_snapshots_connection_user_cycle_unique" ON "cursor_spend_snapshots" ("connection_id", "cursor_external_user_id", "billing_cycle_start", "billing_cycle_end", "snapshot_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cursor_feature_usage_daily_connection_user_date_source_unique" ON "cursor_feature_usage_daily" ("connection_id", "cursor_external_user_id", "usage_date", "ingestion_source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cursor_spend_snapshots_company_idx" ON "cursor_spend_snapshots" ("company_id", "snapshot_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cursor_coaching_findings_company_period_idx" ON "cursor_coaching_findings" ("company_id", "period_start", "period_end");
