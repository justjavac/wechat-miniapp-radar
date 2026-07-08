import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const sensitiveEnvNames = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_API_URL",
  "GITHUB_TOKEN",
  "CRON_SECRET",
  "ADMIN_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "KV_REST_API_READ_ONLY_TOKEN",
  "KV_URL",
  "REDIS_URL",
  "VERCEL_TOKEN"
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".xml"
]);

const publicSecretPattern = /\bNEXT_PUBLIC_[A-Z0-9_]*(?:TOKEN|SECRET|KEY|DATABASE|DB|OPENAI|GITHUB|BLOB|UPSTASH|REDIS|ADMIN|CRON)[A-Z0-9_]*\b/g;
const processEnvPattern = /\bprocess\s*\.\s*env\b/g;

interface Violation {
  file: string;
  line: number;
  reason: string;
}

function extensionOf(file: string) {
  const match = /\.[^.]+$/.exec(file);
  return match?.[0] ?? "";
}

async function collectFiles(root: string): Promise<string[]> {
  const rootStat = await stat(root).catch(() => null);
  if (!rootStat) return [];
  if (rootStat.isFile()) return [root];

  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => ![".git", ".next", "node_modules"].includes(entry.name))
      .map(async (entry) => {
        const file = join(root, entry.name);
        return entry.isDirectory() ? await collectFiles(file) : [file];
      })
  );
  return files.flat();
}

function isTextFile(file: string) {
  return textExtensions.has(extensionOf(file));
}

function lineNumber(content: string, index: number) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function hasUseClientDirective(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const line of lines.slice(0, 8)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    return trimmed === '"use client";' || trimmed === "'use client';" || trimmed === '"use client"' || trimmed === "'use client'";
  }
  return false;
}

function isClientBundleCandidate(file: string, content: string) {
  const normalized = relative(process.cwd(), file).replace(/\\/g, "/");
  return normalized.startsWith("components/") || (normalized.startsWith("app/") && hasUseClientDirective(content));
}

function matches(pattern: RegExp, content: string) {
  pattern.lastIndex = 0;
  return Array.from(content.matchAll(pattern));
}

function addNameViolations(violations: Violation[], file: string, content: string, scope: string) {
  for (const name of sensitiveEnvNames) {
    let index = content.indexOf(name);
    while (index !== -1) {
      violations.push({
        file,
        line: lineNumber(content, index),
        reason: `${scope} must not reference ${name}.`
      });
      index = content.indexOf(name, index + name.length);
    }
  }
}

function addPatternViolations(violations: Violation[], file: string, content: string, pattern: RegExp, reason: string) {
  for (const match of matches(pattern, content)) {
    violations.push({
      file,
      line: lineNumber(content, match.index ?? 0),
      reason
    });
  }
}

const sourceFiles = (await Promise.all(["app", "components"].map(collectFiles))).flat().filter(isTextFile);
const publicFiles = (await collectFiles("public")).filter(isTextFile);
const envDefinitionFiles = (
  await Promise.all(
    [
      ".env.example",
      "app",
      "components",
      "db",
      "drizzle.config.ts",
      "lib",
      "next.config.ts",
      "package.json",
      "postcss.config.js",
      "scripts",
      "tailwind.config.ts",
      "vercel.json"
    ].map(collectFiles)
  )
)
  .flat()
  .filter(isTextFile);

const violations: Violation[] = [];
let clientFileCount = 0;

for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  const relativeFile = relative(process.cwd(), file).replace(/\\/g, "/");
  if (!isClientBundleCandidate(file, content)) continue;

  clientFileCount += 1;
  addPatternViolations(violations, relativeFile, content, processEnvPattern, "Client bundle candidates must not read process.env.");
  addPatternViolations(violations, relativeFile, content, publicSecretPattern, "Client bundle candidates must not define public secret-looking env vars.");
  addNameViolations(violations, relativeFile, content, "Client bundle candidates");
}

for (const file of publicFiles) {
  const content = await readFile(file, "utf8");
  const relativeFile = relative(process.cwd(), file).replace(/\\/g, "/");
  addPatternViolations(violations, relativeFile, content, processEnvPattern, "Public artifacts must not reference process.env.");
  addPatternViolations(violations, relativeFile, content, publicSecretPattern, "Public artifacts must not define public secret-looking env vars.");
  addNameViolations(violations, relativeFile, content, "Public artifacts");
}

for (const file of envDefinitionFiles) {
  const content = await readFile(file, "utf8");
  const relativeFile = relative(process.cwd(), file).replace(/\\/g, "/");
  addPatternViolations(violations, relativeFile, content, publicSecretPattern, "Secret-like values must not use NEXT_PUBLIC_* env names.");
}

assert.equal(
  violations.length,
  0,
  `Secret exposure scan failed:\n${violations.map((violation) => `${violation.file}:${violation.line} ${violation.reason}`).join("\n")}`
);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      clientFiles: clientFileCount,
      publicFiles: publicFiles.length,
      sensitiveEnvNames,
      violations: 0
    },
    null,
    2
  )
);
