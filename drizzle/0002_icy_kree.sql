CREATE TABLE "resource_scores" (
	"resource_id" text PRIMARY KEY NOT NULL,
	"signal_id" text,
	"status" text NOT NULL,
	"maintain_status" text NOT NULL,
	"risk_level" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_scores" ADD CONSTRAINT "resource_scores_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_scores" ADD CONSTRAINT "resource_scores_signal_id_resource_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."resource_signals"("id") ON DELETE set null ON UPDATE no action;