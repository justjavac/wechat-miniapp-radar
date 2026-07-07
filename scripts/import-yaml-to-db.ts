import { createDb } from "@/db/client";
import { resourceAlternatives, resources } from "@/db/schema";
import { mapResourceToDbInsert, mapResourcesToAlternativeDbInserts, mapResourceToDbUpdate } from "@/lib/resource-db-mapping";
import { getResources } from "@/lib/resources";

interface ImportSummary {
  resources: number;
  alternativeLinks: number;
  dryRun: boolean;
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("--no-persist");
const json = args.includes("--json");
const help = args.includes("--help") || args.includes("-h");

function printHelp() {
  console.log(`Usage:
  miniprogram-radar import [--dry-run] [--json]
  npm run db:import -- --dry-run

Options:
  --dry-run, --no-persist  Validate YAML to database mapping without writing Postgres.
  --json                  Print a JSON summary.
  -h, --help              Show this help message.`);
}

function printSummary(summary: ImportSummary) {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (summary.dryRun) {
    console.log(`Dry run mapped ${summary.resources} resources and ${summary.alternativeLinks} alternative links. No database writes were performed.`);
    return;
  }

  console.log(`Imported ${summary.resources} resources and ${summary.alternativeLinks} alternative links into database.`);
}

if (help) {
  printHelp();
  process.exit(0);
}

const rows = await getResources();
const alternativeRows = mapResourcesToAlternativeDbInserts(rows);

if (dryRun) {
  printSummary({ resources: rows.length, alternativeLinks: alternativeRows.length, dryRun: true });
  process.exit(0);
}

const db = createDb();

for (const resource of rows) {
  await db
    .insert(resources)
    .values(mapResourceToDbInsert(resource))
    .onConflictDoUpdate({
      target: resources.id,
      set: mapResourceToDbUpdate(resource)
    });
}

await db.delete(resourceAlternatives);
if (alternativeRows.length > 0) {
  await db.insert(resourceAlternatives).values(alternativeRows);
}

printSummary({ resources: rows.length, alternativeLinks: alternativeRows.length, dryRun: false });
