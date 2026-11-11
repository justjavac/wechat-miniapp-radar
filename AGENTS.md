# 小程序雷达开发指南

本文件面向开发者和代码代理。README 面向最终用户，资源列表由 `data/resources.yaml` 生成，不要在 README 里维护开发、部署和运维细节。

## 部署平台

生产运行在腾讯云 EdgeOne Makers（serverless，无持久磁盘）。数据要么在构建时内联进产物，要么写入 EdgeOne Blob；不要新增任何依赖本地磁盘读写的运行时逻辑。

## 项目结构

- `app/`：Next.js App Router 页面和 API route。
- `components/`：共享 UI 组件。
- `lib/`：业务逻辑、AI、缓存、健康检查、评分、数据库映射和运维辅助模块。
- `db/`：Drizzle schema 与数据库客户端。
- `scripts/`：数据生成、验证、导入、运维和测试脚本。
- `data/resources.yaml`：资源数据源。
- `data/resources.json`：由 `npm run generate` 生成的构建期数据，运行时直接 `import`，必须提交。
- `public/api/resources.json`：由 `npm run generate` 生成的静态资源快照。
- `edgeone.json`：EdgeOne Makers 构建与部署配置。
- `public/api/ai-summaries.json`、`public/api/radar-scores.json`、`public/api/weekly/*`：生成快照，同样在构建时内联。
- `docs/`：本地实施文档，仅保留在本地，不纳入版本库。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

完整校验：

```bash
npm run check
```

## 常用任务

```bash
npm run generate
npm run generate:check
npm run validate
npm run typecheck
npm run deploy:check
npm run integrations:verify
npm run db:verify
npm run db:import:test
npm run advisor:test
npm run doctor:test
npm run cli:test
npm run deployment:verify -- https://miniapp.denohub.com
npm run mvp:check
npm run vercel:preflight -- https://miniapp.denohub.com
npm run production:bootstrap -- https://miniapp.denohub.com
```

CLI examples:

```bash
npx miniprogram-radar health --out=health.md
npx miniprogram-radar resources --type=framework --status=adopt --format=csv --out=resources.csv
npx miniprogram-radar compare --ids=github-com-nervjstaro,github-com-dcloudiouni-app --out=compare.md
npx miniprogram-radar advisor "React 团队做电商小程序，应该选 Taro 还是原生？"
npx miniprogram-radar advisor "React 团队做电商小程序，应该选 Taro 还是原生？" --prompt --out=advisor-prompt.json
npx miniprogram-radar doctor ./my-weapp
```

## 生成文件

- 修改 `data/resources.yaml` 后运行 `npm run generate`。
- README、`data/resources.json` 和 `public/api/resources.json` 都由 `scripts/generate.ts` 生成。
- CI 会运行 `npm run generate:check`，生成源和生成产物必须一致。
- `data/resources.json` 是线上构建的必需输入，忘记提交会导致 EdgeOne 构建失败。

## 环境变量

参考 `.env.example`。

- `DATABASE_URL`：可选，配置后资源导入、采集信号、Advisor 会话和周报会写入 Postgres。不配置时全部走文件与 Blob。
- `SITE_URL` / `NEXT_PUBLIC_SITE_URL`：建议配置，生产站点根地址，用于 canonical sitemap 和 robots 地址。
- `CRON_SECRET`：建议配置，用于保护 `/api/cron/*`。
- `ADMIN_TOKEN`：建议配置，用于保护 `/admin` 和 `/api/admin/*`。
- `GITHUB_TOKEN`：可选，提高 GitHub 采集额度。
- `OPENAI_API_KEY`：可选，用于真实 AI Advisor；未配置、超时或校验失败时使用规则建议。可使用 OpenRouter API key。
- `OPENAI_API_URL`：可选，OpenAI-compatible endpoint；OpenRouter 使用 `https://openrouter.ai/api/v1`。
- `OPENAI_MODEL`：可选，主模型，默认 `openai/gpt-oss-20b:free`。
- `OPENAI_FALLBACK_MODEL`：可选，备用模型，默认 `nvidia/nemotron-nano-9b-v2:free`。
- `EDGEONE_BLOB_STORE`：可选，EdgeOne Blob 命名空间名，默认 `miniprogram-radar`。
- `EDGEONE_PROJECT_ID`、`EDGEONE_API_TOKEN`：可选，仅本地脚本或外部服务直接访问 Blob 时需要。
- `BLOB_BACKEND`：可选，设为 `local` 时把快照写到本地 `public/`，用于调试。
- `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`：可选，用于 Advisor 缓存和分布式限流；单实例部署可留空，使用内存兜底。
- `OPERATION_LOG_RETENTION_DAYS`：可选，运行日志保留天数，默认 30 天。

## 部署检查

- 健康检查：`GET /api/health`，包含资源快照、数据库、集成配置和最近一次 AI Advisor 运行状态。
- 数据库验证：`EXPECT_DATABASE=1 npm run db:verify`
- GitHub/Blob/Redis 验证：`EXPECT_GITHUB=1 EXPECT_BLOB=1 EXPECT_UPSTASH_REDIS=1 npm run integrations:verify`
- 生产就绪 API：`GET /api/admin/readiness`，需 `ADMIN_TOKEN`。
- 部署前置检查：`npm run vercel:preflight -- <production-url>`（脚本名沿用历史命名，实际校验 `edgeone.json` 与定时任务配置）
- MVP 收口检查：`npm run mvp:check`；严格上线模式：`EXPECT_MVP=1 EXPECT_SITE_URL=1 EXPECT_OPENAI=1 npm run mvp:check -- <production-url>`
- 生产初始化计划：`npm run production:bootstrap -- <production-url>`；执行迁移、导入和线上验证时追加 `execute`。
- 生产验证：`VERIFY_CRON_SECRET=<CRON_SECRET> VERIFY_ADMIN_TOKEN=<ADMIN_TOKEN> npm run deployment:verify -- <production-url>`

## Git 与发布流程

- 不直接推送到 `main`。
- 按逻辑分步提交：文档、代码、清理、测试规则等不同类型变更尽量拆成独立 commit。
- 功能和修复使用独立分支，创建 PR 后通过 EdgeOne 预览部署验证。
- 预览和 GitHub checks 通过后再合并。
- 合并后等待 EdgeOne 生产部署完成，手动触发一次 `/api/health` 和 `/api/cron/weekly?dryRun=1` 验证线上状态。
- 定时任务由 `.github/workflows/scheduled-jobs.yml` 触发，需要仓库 Secrets 中配置 `SITE_URL` 和 `CRON_SECRET`。
