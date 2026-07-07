CREATE TABLE "operation_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
