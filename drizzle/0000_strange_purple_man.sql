CREATE TABLE "advisor_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_ai_summaries" (
	"resource_id" text PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"recommendation" text NOT NULL,
	"risk_notes" jsonb NOT NULL,
	"evidence_refs" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"source" text NOT NULL,
	"url" text NOT NULL,
	"payload" jsonb NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"note" text,
	"category_id" text NOT NULL,
	"category_name" text NOT NULL,
	"section_id" text,
	"section_name" text,
	"resource_type" text NOT NULL,
	"status" text NOT NULL,
	"maintain_status" text NOT NULL,
	"risk_level" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_ai_summaries" ADD CONSTRAINT "resource_ai_summaries_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_signals" ADD CONSTRAINT "resource_signals_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;