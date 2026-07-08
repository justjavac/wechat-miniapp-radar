import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

function connectDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false
  });

  return {
    client,
    db: drizzle(client, { schema })
  };
}

const cachedConnections = new Map<string, ReturnType<typeof connectDb>>();

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  const cached = cachedConnections.get(databaseUrl);
  if (cached) return cached.db;

  const connection = connectDb(databaseUrl);
  cachedConnections.set(databaseUrl, connection);
  return connection.db;
}

export async function closeDb(databaseUrl?: string) {
  if (databaseUrl) {
    const cached = cachedConnections.get(databaseUrl);
    if (!cached) return;
    cachedConnections.delete(databaseUrl);
    await cached.client.end();
    return;
  }

  const connections = [...cachedConnections.values()];
  cachedConnections.clear();
  await Promise.all(connections.map((connection) => connection.client.end()));
}

export type DbClient = ReturnType<typeof createDb>;
