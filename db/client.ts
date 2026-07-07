import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false
  });

  return drizzle(client, { schema });
}

export type DbClient = ReturnType<typeof createDb>;
