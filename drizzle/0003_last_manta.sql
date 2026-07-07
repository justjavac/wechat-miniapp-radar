CREATE TABLE "resource_alternatives" (
	"id" text PRIMARY KEY NOT NULL,
	"source_resource_id" text NOT NULL,
	"target_resource_id" text NOT NULL,
	"label" text NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_alternatives" ADD CONSTRAINT "resource_alternatives_source_resource_id_resources_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_alternatives" ADD CONSTRAINT "resource_alternatives_target_resource_id_resources_id_fk" FOREIGN KEY ("target_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;