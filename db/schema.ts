import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const resources = pgTable("resources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull().default(""),
  note: text("note"),
  categoryId: text("category_id").notNull(),
  categoryName: text("category_name").notNull(),
  sectionId: text("section_id"),
  sectionName: text("section_name"),
  resourceType: text("resource_type").notNull(),
  status: text("status").notNull(),
  maintainStatus: text("maintain_status").notNull(),
  riskLevel: text("risk_level").notNull(),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const resourceSignals = pgTable("resource_signals", {
  id: text("id").primaryKey(),
  resourceId: text("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  url: text("url").notNull(),
  payload: jsonb("payload").notNull(),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow()
});

export const resourceScores = pgTable("resource_scores", {
  resourceId: text("resource_id")
    .primaryKey()
    .references(() => resources.id, { onDelete: "cascade" }),
  signalId: text("signal_id").references(() => resourceSignals.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  maintainStatus: text("maintain_status").notNull(),
  riskLevel: text("risk_level").notNull(),
  reasons: jsonb("reasons").notNull(),
  scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow()
});

export const resourceAlternatives = pgTable("resource_alternatives", {
  id: text("id").primaryKey(),
  sourceResourceId: text("source_resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  targetResourceId: text("target_resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const resourceAiSummaries = pgTable("resource_ai_summaries", {
  resourceId: text("resource_id")
    .primaryKey()
    .references(() => resources.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  recommendation: text("recommendation").notNull(),
  riskNotes: jsonb("risk_notes").notNull(),
  useCases: jsonb("use_cases").notNull().default(sql`'[]'::jsonb`),
  notRecommendedFor: jsonb("not_recommended_for").notNull().default(sql`'[]'::jsonb`),
  evidenceRefs: jsonb("evidence_refs").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const weeklyReports = pgTable("weekly_reports", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow()
});

export const advisorSessions = pgTable("advisor_sessions", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  answer: jsonb("answer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const operationLogs = pgTable("operation_logs", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
