import { createWeeklyReport, persistWeeklyReport, uploadWeeklyReport, writeWeeklyFiles } from "@/lib/weekly";

const report = await createWeeklyReport();
const persist = !process.argv.includes("--no-persist") && process.env.npm_config_persist !== "false";
const persisted = persist ? await persistWeeklyReport(report) : false;
const blobUrl = await uploadWeeklyReport(report);

await writeWeeklyFiles(report);

console.log(
  JSON.stringify(
    {
      id: report.id,
      title: report.title,
      generatedAt: report.generatedAt,
      persisted,
      blobUrl,
      files: [`public/api/weekly/latest.json`, `public/api/weekly/index.json`, `public/weekly/${report.id}.md`]
    },
    null,
    2
  )
);
