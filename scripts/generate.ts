import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  API_FILE,
  DATA_FILE,
  type Catalog,
  type Resource,
  flattenForApi,
  flattenResources,
  readData,
  writeJson
} from "./catalog.ts";

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/[\\[\]]/g, "\\$&");
}

function escapeMarkdownLinkUrl(value: string): string {
  return value.replace(/[()\\]/g, (character) => {
    if (character === "(") return "%28";
    if (character === ")") return "%29";
    return "%5C";
  });
}

function renderResource(resource: Resource): string {
  const suffix = resource.description ? ` - ${resource.description}` : "";
  const note = resource.note ? ` ${resource.note}` : "";
  return `- [${escapeMarkdownLinkText(resource.title)}](${escapeMarkdownLinkUrl(resource.url)})${note}${suffix}`;
}

function countCategoryResources(category: Catalog["categories"][number]) {
  return (category.resources ?? []).length + (category.sections ?? []).reduce((total, section) => total + (section.resources ?? []).length, 0);
}

function selectShowcaseResources(catalog: Catalog) {
  const resources = flattenResources(catalog).filter((resource) => resource.categoryId !== "featured");
  const patterns = [/taro/i, /uni-app/i, /mpx/i, /wepy/i, /vant/i, /tdesign/i, /云开发|cloudbase/i, /小程序开发教程/];
  const selected: Resource[] = [];

  for (const pattern of patterns) {
    const resource = resources.find((item) => pattern.test(`${item.title} ${item.description}`));
    if (resource && !selected.some((item) => item.id === resource.id)) selected.push(resource);
  }

  return selected.slice(0, 8);
}

function renderReadme(catalog: Catalog): string {
  const resources = flattenResources(catalog);
  const categoryRows = catalog.categories
    .filter((category) => category.id !== "featured")
    .map((category) => `| ${category.name} | ${countCategoryResources(category)} |`)
    .join("\n");
  const showcaseResources = selectShowcaseResources(catalog).map(renderResource);

  const parts = [
    `<h1 align="center">${catalog.title}</h1>`,
    "",
    catalog.description,
    "",
    "> 本 README 由 `data/resources.yaml` 自动生成。请不要手工编辑资源列表。",
    "",
    "## 当前能力",
    "",
    "- Radar：按推荐状态、风险等级、资源类型、分类和适用场景浏览小程序生态资源。",
    "- Quick Search：全站快速搜索资源和跳转常用命令。",
    "- Export：按当前筛选导出资源 JSON 或 CSV，Admin 可上传 Blob 快照。",
    "- Compare：对比 Taro、uni-app、原生小程序等核心方案。",
    "- Advisor：基于本地资源库和规则生成选型建议，可导出模型 prompt contract。",
    "- Weekly：生成生态周报快照，后续由 Vercel Cron 定时更新。",
    "- Doctor：扫描小程序项目结构、框架依赖和配置风险，输出体检报告，可选上传 Blob 快照。",
    "- Admin：查看部署健康、集成配置、资源规模和关键运维端点。",
    "",
    "## 数据概览",
    "",
    `当前数据集中包含 ${resources.length} 个小程序生态资源。README 不再展开完整 awesome 列表，完整资源请通过 Radar 页面、API 或导出能力查看。`,
    "",
    "| 分类 | 资源数 |",
    "| --- | ---: |",
    categoryRows,
    "",
    "## 核心样例",
    "",
    ...showcaseResources,
    "",
    "完整数据入口：",
    "",
    "- Radar 页面：`/radar`",
    "- 资源 API：`GET /api/resources`",
    "- 详情 API：`GET /api/resources/[id]`",
    "- 导出 API：`GET /api/export/resources?format=json|csv`",
    "- 静态 JSON：[`public/api/resources.json`](public/api/resources.json)",
    "",
    "## 本地运行",
    "",
    "```bash",
    "npm install",
    "npm run dev",
    "```",
    "",
    "生产构建：",
    "",
    "```bash",
    "npm run build",
    "```",
    "",
    "常用任务：",
    "",
    "```bash",
    "npm run check",
    "npm run integrations:verify",
    "npm run integrations-verify:test",
    "npm run db:import:test",
    "npm run db:verify",
    "npm run db-verify:test",
    "npm run enrich -- -- --limit=30 --no-persist",
    "npm run enrich:test",
    "npm run resources-api:test",
    "npm run radar-url:test",
    "npm run export-api:test",
    "npm run compare-api:test",
    "npm run alternatives:test",
    "npm run score",
    "npm run score-trace:test",
    "npm run operation-log:test",
    "npm run task-lock:test",
    "npm run site-url:test",
    "npm run ai:summarize -- -- --no-persist",
    "npm run production-readiness:test",
    "npm run ai-output:test",
    "npm run security:test",
    "npm run secret-exposure:test",
    "npm run admin-api:test",
    "npm run cron-routes:test",
    "npx miniprogram-radar ai-summarize --limit=20 --dry-run --json",
    "npx miniprogram-radar enrich --limit=10 --dry-run",
    "npx miniprogram-radar health --out=health.md",
    "npx miniprogram-radar import --dry-run --json",
    "npx miniprogram-radar resources --type=framework --status=adopt --format=csv --out=resources.csv",
    "npx miniprogram-radar resources --format=json --upload --out=resources.json",
    "npx miniprogram-radar compare --ids=github-com-nervjstaro,github-com-dcloudiouni-app --out=compare.md",
    "npx miniprogram-radar score --out=score.md",
    "npm run weekly -- -- --no-persist",
    "npx miniprogram-radar weekly --out=weekly.md",
    "npm run weekly:test",
    "npx miniprogram-radar advisor \"React 团队做电商小程序，应该选 Taro 还是原生？\"",
    "npx miniprogram-radar advisor \"React 团队做电商小程序，应该选 Taro 还是原生？\" --prompt --out=advisor-prompt.json",
    "npm run advisor:test",
    "npm run doctor -- ./my-weapp",
    "npx miniprogram-radar doctor ./my-weapp",
    "npm run doctor -- ./my-weapp --upload",
    "npm run doctor:test",
    "npm run cli:test",
    "npm run deploy:check",
    "npm run mvp:check",
    "npx miniprogram-radar verify --json",
    "npm run vercel:preflight -- https://your-project.vercel.app",
    "npm run production:bootstrap -- https://your-project.vercel.app",
    "npm run vercel-preflight:test",
    "npm run production-bootstrap:test",
    "npm run deployment:verify -- https://your-project.vercel.app",
    "npm run deployment-verify:test",
    "npm run mvp-check:test",
    "npm run smoke",
    "```",
    "",
    "## 部署环境变量",
    "",
    "参考 [`.env.example`](.env.example)。",
    "",
    "- `DATABASE_URL`：可选，配置后资源导入、采集信号、Advisor 会话和周报会写入 Postgres。",
    "- `SITE_URL` / `NEXT_PUBLIC_SITE_URL`：可选，配置生产站点根地址，用于生成 canonical sitemap 和 robots 地址。",
    "- `CRON_SECRET`：建议配置，用于保护 `/api/cron/*`。",
    "- `ADMIN_TOKEN`：建议配置，用于保护 `/admin` 和 `/api/admin/*`。",
    "- `GITHUB_TOKEN`：可选，提高 GitHub 采集额度。",
    "- `OPENAI_API_KEY`：可选，后续用于真实 AI Advisor；未配置时使用规则建议。",
    "- `BLOB_READ_WRITE_TOKEN`：可选，用于上传周报快照、资源导出快照和 Doctor 报告。",
    "- `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` 或 Vercel Marketplace 自动注入的 `KV_REST_API_URL`、`KV_REST_API_TOKEN`：可选，配置后用于 Advisor 缓存和分布式限流；未配置时使用内存限流兜底。",
    "- `OPERATION_LOG_RETENTION_DAYS`：可选，运行日志保留天数，默认 30 天。",
    "- `VERCEL_TOKEN`、`VERCEL_PROJECT_ID`、`VERCEL_ORG_ID`：可选，用于非交互 Vercel CLI 部署或 preflight；通过 Vercel GitHub 集成部署时可以不配置。",
    "",
    "## 部署检查",
    "",
    "- 健康检查：`GET /api/health`",
    "- 数据库验证：`EXPECT_DATABASE=1 npm run db:verify`",
    "- GitHub/Blob/Redis 验证：`EXPECT_GITHUB=1 EXPECT_BLOB=1 EXPECT_UPSTASH_REDIS=1 npm run integrations:verify`",
    "- 运维控制台：`GET /admin`",
    "- 生产就绪 API：`GET /api/admin/readiness`，需 `ADMIN_TOKEN`。",
    "- 项目体检：`GET /doctor`、`POST /api/doctor`",
    "- 资源维护 API：`PATCH /api/admin/resources/[id]`",
    "- 资源导出 API：`GET /api/export/resources?format=json|csv`",
    "- 周报 API：`GET /api/weekly`",
    "- 周报 RSS：`GET /weekly.xml`",
    "- 站点地图：`GET /sitemap.xml`",
    "- Robots：`GET /robots.txt`",
    "- AI 摘要 API：`GET /api/ai-summaries`",
    "- 密钥暴露扫描：`npm run secret-exposure:test`",
    "- Vercel 部署前置检查：`npm run vercel:preflight -- <production-url>`；严格模式：`EXPECT_VERCEL_DEPLOY=1 npm run vercel:preflight -- <production-url>`",
    "- MVP 收口检查：`npm run mvp:check`；严格上线模式：`EXPECT_MVP=1 EXPECT_SITE_URL=1 EXPECT_OPENAI=1 npm run mvp:check -- <production-url>`",
    "- 生产初始化计划：`npm run production:bootstrap -- <production-url>`；执行迁移、导入和线上验证时追加 `execute`，最终收口可追加 `expect-vercel-deploy`、`expect-mvp` 和 `expect-site-url`，计划阶段会列出缺失生产变量；执行模式按顺序运行，任一步失败会跳过后续步骤。配置 `CRON_SECRET` 后会自动 dry-run 验证 Cron 授权链路；配置 `ADMIN_TOKEN` 后会自动验证 Admin readiness 授权读取。",
    "- Vercel 生产验证 workflow：`.github/workflows/verify-vercel.yml`，可手动输入 Production URL，或在 Vercel Production `deployment_status` 成功后自动执行；可用 GitHub Variables `EXPECT_VERCEL_DEPLOY`、`EXPECT_MVP`、`EXPECT_DATABASE`、`EXPECT_BLOB`、`EXPECT_UPSTASH_REDIS`、`EXPECT_SITE_URL`、`EXPECT_OPENAI` 控制严格验收，并用 `SITE_URL`/`NEXT_PUBLIC_SITE_URL`、`VERCEL_PROJECT_ID`、`VERCEL_ORG_ID` 配置生产项目上下文；`VERCEL_TOKEN`、`ADMIN_TOKEN`、`CRON_SECRET`、`RADAR_GITHUB_TOKEN`、`BLOB_READ_WRITE_TOKEN` 和 Redis REST 变量（`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` 或 `KV_REST_API_URL`/`KV_REST_API_TOKEN`）放 GitHub Secrets。",
    "- 采集 Cron：`GET /api/cron/enrich`",
    "- 周报 Cron：`GET /api/cron/weekly`",
    "- 生产验证：`VERIFY_CRON_SECRET=<CRON_SECRET> VERIFY_ADMIN_TOKEN=<ADMIN_TOKEN> npm run deployment:verify -- <production-url>` 可 dry-run 验证授权周报 Cron，并验证 Admin readiness 授权读取。",
    "",
    "## QQ交流群",
    "",
    ...(catalog.qqGroups ?? []).map((group) => `- [${group.name}](${group.url})：${group.note}`),
    "",
    "## 数据维护",
    "",
    "- 资源数据源：[`data/resources.yaml`](data/resources.yaml)",
    "- Web 应用：[`app`](app)",
    "- API：[`public/api/resources.json`](public/api/resources.json)",
    "- 本地实施文档：`docs/` 仅保留在本地，不纳入版本库。",
    "- 本地校验：`npm run check`",
    ""
  ];

  return `${parts.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

async function writeIfChanged(file: string, content: string, check: boolean): Promise<boolean> {
  let current = null;
  try {
    current = await readFile(file, "utf8");
  } catch {
    // The file will be created below.
  }

  if (current === content) return false;
  if (check) {
    throw new Error(`${file} is out of date. Run npm run generate.`);
  }

  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return true;
}

const check = process.argv.includes("--check");
const catalog = await readData<Catalog>(DATA_FILE);
const readmeChanged = await writeIfChanged("README.md", renderReadme(catalog), check);
const api = {
  name: catalog.name,
  title: catalog.title,
  description: catalog.description,
  generatedFrom: DATA_FILE,
  resources: flattenForApi(catalog)
};

if (check) {
  const apiBefore = await readFile(API_FILE, "utf8").catch(() => null);
  if (apiBefore !== `${JSON.stringify(api, null, 2)}\n`) {
    throw new Error(`${API_FILE} is out of date. Run npm run generate.`);
  }
} else {
  await writeJson(API_FILE, api);
}

if (!check) {
  console.log(`Generated README.md${readmeChanged ? "" : " (unchanged)"}`);
  console.log(`Generated ${API_FILE}`);
}
