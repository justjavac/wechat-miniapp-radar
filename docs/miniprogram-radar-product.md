# 小程序雷达产品方案

配套落地文档：

- 文档索引：[`docs/README.md`](./README.md)
- 实施总方案：[`docs/miniprogram-radar-master-implementation-plan.md`](./miniprogram-radar-master-implementation-plan.md)
- Vercel 生产实施方案：[`docs/miniprogram-radar-vercel-production-plan.md`](./miniprogram-radar-vercel-production-plan.md)
- 实施追踪表：[`docs/miniprogram-radar-implementation-tracker.md`](./miniprogram-radar-implementation-tracker.md)

## 一、产品定位

小程序雷达是一个 AI 驱动的微信小程序生态情报与选型工具。

它的目标不是继续做一个静态资源收集列表，而是把现有的小程序开发资源转化为可检索、可评估、可推荐、可生成报告的生态数据库，帮助开发者在小程序框架、组件库、工具链、云服务、SDK 和工程实践之间做更可靠的技术判断。

一句话定位：

> 小程序雷达，帮助开发者发现、评估和选择微信小程序生态中的技术方案。

副标题：

> AI 驱动的小程序生态选型与风险评估工具。

## 二、为什么要做这个改造

当前项目主要是 awesome 风格的资源整理，核心价值来自人工收集和分类。随着小程序生态变化，单纯的链接列表存在几个问题：

- 很难判断资源是否仍然维护。
- 很难判断某个工具是否适合新项目。
- 很难比较不同框架、组件库和工具链的实际差异。
- 很难根据具体业务场景给出选型建议。
- 很难持续跟踪生态变化。

小程序雷达的改造方向是把资源列表升级为生态情报系统。AI 不作为内容主题，而作为产品能力，用来辅助资源理解、标签生成、风险判断、选型问答、项目诊断和生态简报生成。

## 三、目标用户

### 1. 小程序开发者

他们需要快速了解某个库是否还值得使用，以及当前有哪些更好的替代方案。

典型问题：

- 现在还推荐用 WePY 吗？
- 小程序项目用 Taro、uni-app 还是原生开发？
- 有哪些仍在维护的 UI 组件库？
- 某个 SDK 是否适合生产项目？

### 2. 技术负责人

他们需要为团队制定小程序技术栈，关注长期维护、团队成本、生态成熟度和迁移风险。

典型问题：

- React 团队做小程序应该选什么框架？
- 多端项目该选 Taro 还是 uni-app？
- 老项目是否需要迁移？
- 哪些依赖会带来维护风险？

### 3. 开源维护者和工具作者

他们需要了解小程序生态中同类项目的状态、定位和差异。

典型问题：

- 我的工具在生态中属于什么位置？
- 同类工具有哪些？
- 如何让工具更容易被开发者发现？

## 四、核心产品模块

### 1. Radar：小程序技术雷达

Radar 是产品的主界面，用来展示小程序生态中的关键技术资源。

资源类型包括：

- 开发框架：Taro、uni-app、MPX、Remax、原生小程序等。
- UI 组件库：Vant Weapp、TDesign、WeUI、Wux Weapp 等。
- 工程工具：构建、调试、CLI、包管理、转换工具。
- 后端与云服务：云开发、Serverless、BaaS、CMS、鉴权服务。
- SDK：支付、地图、登录、数据统计、IM、客服、内容安全等。
- 示例项目：完整业务 demo、最佳实践模板、迁移示例。
- 官方文档与规范：微信官方文档、设计指南、审核规则等。

每个资源不再只是一个链接，而是一个带有判断信息的条目：

- 当前状态：推荐、可试用、需评估、不建议新项目使用。
- 维护状态：活跃、低频维护、停止维护、未知。
- 适合场景：新项目、老项目维护、多端项目、企业项目、个人项目等。
- 风险等级：低、中、高。
- 替代方案：同类资源推荐。
- AI 摘要：一句话说明它解决什么问题。
- 证据来源：GitHub、npm、官网、文档、提交记录等。

### 2. Advisor：AI 选型顾问

Advisor 负责回答开发者的技术选型问题。

用户可以用自然语言描述需求：

```text
我们团队熟悉 React，要做一个电商小程序，后续可能上 H5，应该选 Taro 还是原生？
```

系统基于本地资源数据库、评分模型和 AI 总结能力输出建议：

- 推荐方案。
- 不推荐方案。
- 适用条件。
- 主要风险。
- 替代选择。
- 推荐资源入口。
- 后续验证清单。

示例输出结构：

```md
## 推荐结论

建议优先评估 Taro。

## 理由

- 团队已有 React 经验，学习成本较低。
- 后续有 H5 诉求，跨端框架比原生更适合。
- Taro 生态成熟度较高，资料和社区规模更稳定。

## 风险

- 复杂页面性能需要单独验证。
- 部分微信原生能力可能需要额外适配。

## 替代方案

- 如果团队更熟悉 Vue，可以评估 uni-app。
- 如果只做微信单端且性能要求高，可以考虑原生小程序。
```

### 3. Doctor：项目体检

Doctor 面向已有小程序项目，提供自动扫描和 AI 诊断报告。

用户运行：

```bash
npx miniprogram-radar doctor ./my-weapp
```

扫描内容包括：

- 项目类型识别：原生、Taro、uni-app、WePY、mpvue、Remax 等。
- 语言识别：JavaScript、TypeScript。
- 配置检查：`project.config.json`、分包配置、插件配置。
- 依赖检查：过时依赖、停维依赖、风险依赖。
- 框架风险：是否使用已经明显过时的技术栈。
- 工程实践：构建工具、代码结构、云函数、环境变量、密钥暴露风险。

输出报告包括：

- 项目概览。
- 健康评分。
- 主要风险。
- 优先修复项。
- 迁移建议。
- 推荐资源。
- AI 总结。

### 4. Weekly：生态周报

Weekly 用来跟踪小程序生态变化，形成可持续的内容输出。

自动采集和分析：

- 重要项目最近更新。
- GitHub star 或 issue 活跃变化。
- npm 包发布变化。
- 微信官方文档变化。
- 新出现的工具、组件和 SDK。
- 长期未维护项目预警。

输出形式：

- 每周 Markdown 周报。
- 网页时间线。
- RSS 或 JSON API。
- GitHub Release 或 Discussion。

## 五、AI 能力设计

AI 在产品中负责增强判断和生成能力，但不直接替代事实数据。

### 1. AI 资源理解

AI 读取资源的 README、官网简介、package 信息和 GitHub 元数据，生成结构化信息：

```json
{
  "summary": "适合 Vue 团队开发多端小程序的成熟框架",
  "useCases": ["多端发布", "Vue 团队", "中大型项目"],
  "notRecommendedFor": ["极轻量微信单端项目"],
  "riskLevel": "low",
  "alternatives": ["Taro", "MPX"],
  "tags": ["framework", "cross-platform", "vue"]
}
```

### 2. AI 风险判断

AI 结合事实指标生成风险判断：

- 最近提交时间。
- 最近 release 时间。
- issue 响应情况。
- README 和文档更新时间。
- 是否归档。
- npm 下载和发布时间。
- 是否存在明显迁移或停维公告。

风险判断必须保留证据，避免只给结论。

### 3. AI 选型问答

AI 基于资源库回答问题，回答时应引用具体资源和判断依据。

适合的问题：

- Taro 和 uni-app 怎么选？
- 现在还有必要用 WePY 吗？
- 哪些 UI 组件库适合企业项目？
- 原生小程序和跨端框架的主要取舍是什么？

不适合的问题：

- 与小程序生态无关的泛编程问题。
- 没有事实依据的主观排名。
- 需要实时商业报价但没有数据源的问题。

### 4. AI 报告生成

AI 把扫描结果、资源数据和规则判断整合为可读报告。

报告应包含：

- 结论。
- 依据。
- 风险。
- 优先级。
- 可执行建议。
- 相关资源链接。

## 六、数据结构建议

当前 `data/resources.yaml` 可以逐步扩展为更适合雷达产品的数据结构。

建议字段：

```yaml
- id: taro
  title: Taro
  url: https://github.com/NervJS/taro
  category: framework
  description: 使用 React 语法开发小程序和多端应用的框架
  status: adopt
  maintainStatus: active
  riskLevel: low
  useCases:
    - React 团队
    - 多端应用
    - 中大型项目
  notRecommendedFor:
    - 极轻量微信单端项目
  alternatives:
    - uni-app
    - MPX
    - 原生小程序
  signals:
    github:
      repo: NervJS/taro
      stars: null
      lastCommitAt: null
      lastReleaseAt: null
      archived: false
    npm:
      package: "@tarojs/taro"
      lastPublishAt: null
  ai:
    summary: React 团队做多端小程序时值得优先评估的成熟框架
    recommendation: 适合有跨端诉求且团队熟悉 React 的项目
    riskNotes:
      - 复杂页面性能需要结合业务验证
      - 微信原生能力可能需要额外适配
  evidence:
    - type: github
      url: https://github.com/NervJS/taro
    - type: docs
      url: https://docs.taro.zone/
```

Radar 状态建议：

- `adopt`：推荐用于新项目。
- `trial`：可以试用，适合特定场景。
- `assess`：需要谨慎评估后使用。
- `hold`：不建议新项目使用，除非维护老项目。

## 七、MVP 范围

第一阶段目标是把项目从资源列表升级为可用的雷达雏形，不追求一次性完成全部 AI 自动化。

### MVP 1：数据升级

完成内容：

- 为核心资源增加 `status`、`maintainStatus`、`riskLevel`、`useCases`、`alternatives` 字段。
- 优先覆盖框架、组件库、工具链三个分类。
- 保留现有 README 生成能力。
- 增加数据校验规则，避免字段缺失和状态值不合法。

验收标准：

- 至少 30 个核心资源具备雷达字段。
- `npm run check` 可以通过。
- README 或网页能展示推荐状态和风险等级。

### MVP 2：雷达网页

完成内容：

- 将现有搜索页升级为雷达视图。
- 支持按类型、状态、风险等级、适用场景筛选。
- 每个资源展示 AI 摘要、推荐状态和替代方案。
- 增加“推荐使用”“谨慎评估”“不建议新项目使用”等视图。

验收标准：

- 用户可以快速找到当前推荐的框架、组件库和工具。
- 用户可以看到不建议使用的过时项目及原因。

### MVP 3：选型顾问原型

完成内容：

- 提供一个简单的问答入口。
- 先用规则和本地数据生成结构化上下文。
- 再调用 AI 生成自然语言建议。
- 支持 Taro、uni-app、原生、MPX、WePY、mpvue 等核心方案对比。

验收标准：

- 能回答 5 到 10 个典型选型问题。
- 回答必须引用资源库中的项目和证据字段。
- 回答不能只依赖模型常识。

## 八、后续路线

### 第二阶段：Doctor 项目体检

- 新增 CLI。
- 扫描小程序项目结构。
- 识别框架和依赖。
- 输出健康报告。
- 接入 AI 总结。

### 第三阶段：生态数据自动更新

- GitHub API 元数据采集。
- npm 元数据采集。
- 链接可用性检测。
- README 和官网摘要更新。
- 维护状态自动判定。

### 第四阶段：生态周报

- 自动生成每周更新摘要。
- 标记重要变化。
- 形成长期内容输出。

## 九、技术实现建议

### 技术栈

小程序雷达建议使用以下技术栈落地：

- 应用框架：Next.js，优先使用 App Router。
- 语言：TypeScript。
- 样式：Tailwind CSS。
- 组件库：shadcn/ui。
- 图标：lucide-react。
- 部署平台：Vercel。
- 数据库：通过 Vercel Marketplace 接入数据库，优先评估 Neon Postgres、Supabase 或 Turso。
- ORM：Drizzle ORM，负责 schema、迁移和类型安全查询。
- AI 接入：服务端 Route Handler 调用模型 API，不在前端暴露密钥。
- 定时任务：Vercel Cron，Hobby 阶段按每天一次设计。
- 数据采集：GitHub API、npm registry、项目官网和 README。
- 可选缓存：Upstash Redis 或数据库缓存表，用于 AI 问答结果、热门查询和接口限流。Vercel KV 已转向 Upstash Redis，不建议按新产品能力单独规划。

这个技术栈适合当前项目的原因：

- Next.js 适合同时承载静态雷达页面、服务端 API、AI 问答接口和后台管理页。
- Tailwind CSS 与 shadcn/ui 能快速搭建筛选、表格、详情页、对话框、表单和仪表盘。
- Vercel 与 Next.js 部署路径最短，适合先做 MVP。
- Neon Postgres 足够存储资源、评分、采集记录、AI 摘要和后续用户反馈；如果需要更完整的后台、Auth 和对象存储能力，可以评估 Supabase。
- Drizzle ORM 轻量、类型清晰，适合以结构化数据为核心的工具项目。

### 前端

前端从当前 `public/index.html` 升级为 Next.js 应用。

核心页面建议：

- `/`：雷达首页，展示推荐资源、风险资源、热门分类和搜索入口。
- `/radar`：技术雷达主视图，支持按分类、状态、风险等级、适用场景筛选。
- `/resources/[id]`：资源详情页，展示摘要、状态、证据、替代方案和更新记录。
- `/compare`：方案对比页，例如 Taro vs uni-app vs 原生小程序。
- `/advisor`：AI 选型顾问。
- `/weekly`：生态周报。
- `/admin`：后续可选的资源维护后台。

shadcn/ui 优先使用这些组件：

- `Table`：资源列表和对比表。
- `Card`：资源摘要项。
- `Badge`：状态、风险等级、标签。
- `Tabs`：Radar、Advisor、Doctor、Weekly 之间的视图切换。
- `Command`：快速搜索和命令菜单。
- `Dialog`：资源详情、AI 解释、风险说明。
- `Select`、`Checkbox`、`Slider`：筛选条件。
- `Textarea`、`Button`：AI 选型输入和提交。

### 数据与脚本

短期继续沿用当前数据结构，逐步迁移到数据库。

当前结构：

- `data/resources.yaml`：核心数据源。
- `scripts/generate.ts`：生成 README 和 API。
- `scripts/validate-data.ts`：校验数据。
- `public/api/resources.json`：静态资源 API。

迁移后的建议结构：

- `resources`：资源基础信息。
- `resource_signals`：GitHub、npm、官网、文档等采集信号。
- `resource_scores`：维护状态、风险等级、推荐状态。
- `resource_ai_summaries`：AI 摘要、选型建议、风险说明。
- `resource_alternatives`：替代方案关系。
- `weekly_reports`：生态周报。
- `advisor_sessions`：可选，记录用户问题和 AI 回答摘要。

建议新增脚本：

- `scripts/import-yaml-to-db.ts`：将现有 YAML 导入目标数据库。
- `scripts/enrich-resources.ts`：采集 GitHub、npm 和官网信息。
- `scripts/score-resources.ts`：基于规则生成维护状态和风险等级。
- `scripts/ai-summarize.ts`：生成或更新 AI 摘要字段。
- `scripts/generate-weekly.ts`：生成生态周报。

### API 与服务端

Next.js Route Handler 建议提供这些接口：

- `GET /api/resources`：资源列表，支持筛选和分页。
- `GET /api/resources/:id`：资源详情。
- `GET /api/compare`：方案对比数据。
- `POST /api/advisor`：AI 选型问答。
- `POST /api/admin/resources`：后续后台维护资源。
- `GET /api/cron/enrich`：Vercel Cron 触发采集。
- `GET /api/cron/weekly`：Vercel Cron 触发生态周报生成。

公开读接口应优先走缓存或静态生成，避免每次页面访问都打数据库。

### 部署

部署平台使用 Vercel。

建议策略：

- 静态页面和公开资源页尽量使用静态生成或 ISR。
- AI 问答、数据采集、后台维护走 Vercel Functions。
- Vercel Cron 在 Hobby 阶段按每天一次更新生态数据。
- 环境变量只配置在 Vercel 服务端环境中，包括数据库连接串、GitHub Token、AI API Key。
- 不把任何密钥写入前端 bundle 或公开 JSON。

Hobby 免费资源足够支撑 MVP，但需要注意：

- Cron 只能按每天一次的粒度设计。
- 数据库免费额度取决于 Marketplace 数据库，例如 Neon Free。
- AI token 费用不属于 Vercel 免费资源。
- 公开 AI 接口需要限流、缓存和异常保护。

### 免费资源评估

小程序雷达的 MVP 以公开浏览、静态/ISR 页面、少量定时采集和少量 AI 问答为主，Vercel Hobby 免费资源整体够用。真正需要控制的是数据库容量、AI token 成本、公开 AI 接口滥用和定时任务频率。以下额度按当前公开免费计划整理，Vercel 和 Marketplace 服务商可能调整，上线前需要再复核控制台与官方定价页。

Vercel Hobby 主要免费资源：

| 能力 | 免费额度 | 对小程序雷达的判断 |
| --- | --- | --- |
| Fast Data Transfer | 100 GB/月 | 足够支撑公开雷达页、资源详情页和静态 JSON。 |
| Fast Origin Transfer | 10 GB/月 | MVP 足够，避免大文件从源站频繁回源。 |
| Edge Requests | 100 万次/月 | 公开页面访问初期足够。 |
| Function Invocations | 100 万次/月 | 足够承载资源 API、AI 入口和后台接口，但 AI 接口要限流。 |
| Fluid Active CPU | 4 小时/月 | 适合轻量 API，不适合在请求内做大规模爬取或长任务。 |
| Fluid Provisioned Memory | 360 GB-hours/月 | MVP 足够。 |
| ISR Reads | 100 万次/月 | 适合资源详情页和榜单页。 |
| Edge Request CPU Duration | 1 小时/月 | Edge Middleware 只做轻量鉴权、跳转、限流判断。 |
| Runtime Logs | Hobby 保留 1 小时 | 排障能力有限，重要错误需要写入数据库或外部日志服务。 |

Vercel Cron Hobby 限制：

| 能力 | 免费额度/限制 | 对小程序雷达的判断 |
| --- | --- | --- |
| Cron Jobs | 100 个/项目 | 数量足够。MVP 只需要 `enrich` 和 `weekly` 两类任务。 |
| 最小触发间隔 | 每天一次 | 适合每日采集 GitHub/npm 信号，不适合分钟级监控。 |
| 调度精度 | 小时级，可能有约 59 分钟偏移 | 周报、日更任务可以接受。 |
| 执行成本 | 触发 Vercel Functions，计入函数用量 | 采集任务需要分页、超时保护和增量更新。 |

存储与缓存免费资源：

| 服务 | 免费额度 | 适合用途 | 不适合用途 |
| --- | --- | --- | --- |
| Vercel Blob Hobby | 1 GB 存储/月、1 万次 simple operations/月、2000 次 advanced operations/月、10 GB Blob data transfer/月 | 存 AI 生成的周报快照、JSON 导出、Doctor 报告、截图或日志归档。 | 不适合作主数据库，不适合高频小对象读写。 |
| Upstash Redis Free | 256 MB 数据、50 万 commands/月、10 GB bandwidth、最高 10000 commands/sec | 热门查询缓存、AI 问答缓存、接口限流、短期任务锁。 | 不适合长期结构化数据存储。 |
| Vercel Edge Config Hobby | 10 万 reads/月、100 writes/月 | Feature flag、全局配置、公告开关、模型开关。 | 不适合资源库、报告、用户数据。 |

数据库服务免费额度对比：

| 服务 | 免费额度 | 优势 | 风险/限制 | 对本项目建议 |
| --- | --- | --- | --- | --- |
| Supabase Free | 2 个 active projects、每项目 500 MB 数据库、无限 API requests、5 GB egress、5 GB cached egress、1 GB file storage、50000 MAU、50 万 Edge Function invocations；免费项目长期不活跃可能暂停 | 能同时提供 Postgres、Auth、Storage、后台管理界面和 API，产品化能力完整。 | 数据库容量只有 500 MB；如果只需要数据库，能力偏重。 | 如果后续要做账号、收藏、后台管理、文件存储，优先考虑。 |
| Neon Free | 100 projects、每项目 10 branches、100 CU-hours、0.5 GB storage、5 GB public egress、自动扩缩到 2 CU；超出免费月度限制会暂停 compute | 纯 Postgres 体验好，适合 Next.js + Drizzle，分支能力适合预览环境。 | 存储也是 0.5 GB；计算小时需要关注。 | 如果 MVP 只需要结构化数据库，优先考虑。 |
| Turso Free | 100 databases、5 GB storage、5 亿 rows read/月、1000 万 rows written/月、3 GB syncs/月 | 免费存储和读额度最高，读多写少的公开资源库很合适。 | 是 SQLite/libSQL，不是 Postgres；复杂关系、生态和迁移方式与 Postgres 不同。 | 如果追求最高免费额度、数据模型简单且读多写少，可以评估。 |
| Upstash Redis Free | 256 MB 数据、50 万 commands/月、10 GB bandwidth | 与 Vercel 集成方便，适合缓存和限流。 | 不是主数据库。 | 作为缓存层，不作为资源数据库。 |

数据库初步结论：

- 如果坚持 Postgres + Drizzle，MVP 优先选 Neon，路径最简单。
- 如果希望顺手获得 Auth、Storage、后台管理和更完整 BaaS 能力，选 Supabase 更合适。
- 如果公开数据读多写少，并且愿意接受 SQLite/libSQL，Turso 的免费额度最高。
- 对小程序雷达而言，早期资源条目、评分、采集信号和 AI 摘要的数据量很小，Neon 或 Supabase 的 500 MB 级免费数据库都够用；AI 生成结果要做去重和缓存，避免无意义膨胀。

### Vercel 能力评估

Vercel 可以用上的能力：

| Vercel 能力 | 是否建议使用 | 用法 |
| --- | --- | --- |
| Deployments / Preview Deployments | 建议使用 | 每个 PR 自动生成预览环境，方便检查雷达页、详情页和后台表单。 |
| Static / ISR / CDN | 核心能力 | 公开雷达页、资源详情页、榜单页尽量静态化或 ISR，降低数据库和函数压力。 |
| Vercel Functions / Route Handlers | 核心能力 | 承载资源 API、AI Advisor、对比接口、后台维护接口和 Cron 任务入口。 |
| Vercel Cron | 建议使用 | 每日采集 GitHub/npm/官网信号，每周生成生态周报。 |
| Vercel Blob | 可用 | 存储 AI 周报、导出的 JSON 快照、Doctor 报告和截图，不作为主数据库。 |
| Vercel Marketplace Databases | 核心能力 | 接入 Neon、Supabase、Turso 或 Upstash，减少自建运维。 |
| Web Analytics | 建议使用 | 了解用户常看的分类、资源和页面，反向优化 Radar 数据。 |
| Speed Insights | 建议使用 | 观察 Next.js 页面性能，避免资源列表和详情页变慢。 |
| Firewall / Rate Limiting | 建议评估 | 保护公开 AI 接口、Advisor 提交接口和后台接口，防止滥用。具体额度与可用能力需以上线时 Vercel 控制台为准。 |
| Edge Config | 可选 | 存模型开关、功能开关、公告配置，不存业务数据。 |
| Image Optimization | 可选 | 如果后续展示项目 logo、截图或生态图谱，可以使用；MVP 可以先不用。 |

暂时不建议投入的能力：

- Microfrontends：当前项目体量不需要。
- 高级 WAF 规则和企业 SSO：等出现团队协作、付费用户或攻击压力后再考虑。
- Observability Plus：MVP 可先用基础日志，重要错误写入数据库。
- Blob 作为数据库：Blob 适合对象和快照，不适合筛选、排序、关联查询。
- Edge Config 作为数据库：Edge Config 适合小型全局配置，不适合资源库。
- Supabase Realtime：除非后续做多人后台协作或实时通知，否则暂不需要。

### AI 接入

AI 调用放在服务端 Route Handler 或定时脚本中，不直接从浏览器调用模型 API。

基础原则：

- 没有 AI API Key 时，Radar 基础浏览、搜索和筛选仍能运行。
- AI 生成内容应写回数据库或生成报告，避免每次访问重复生成。
- AI 结论需要保留证据字段，尤其是维护风险和推荐状态。
- 不把 API Key 暴露到前端。
- AI 问答必须基于本地资源库、评分和证据生成上下文。
- 对相同问题、同类对比和热门资源摘要做缓存。

## 十、项目命名建议

中文名：

```text
小程序雷达
```

英文名：

```text
miniprogram-radar
```

备用名称：

- `weapp-radar`
- `wechat-miniprogram-radar`
- `weapp-doctor`

推荐仓库名：

```text
miniprogram-radar
```

理由：

- 不局限于微信旧称 weapp。
- 比 awesome 类型项目更像产品。
- 能同时承载 Radar、Advisor、Doctor 和 Weekly。

## 十一、README 改造建议

新的 README 不应继续以“资源汇总”为主，而应该突出产品能力。

建议结构：

```md
# 小程序雷达

AI 驱动的小程序生态选型与风险评估工具。

## 它能做什么

- 查看小程序生态技术雷达
- 判断框架和组件库是否仍值得使用
- 对比 Taro、uni-app、原生等方案
- 获取 AI 选型建议
- 生成小程序项目体检报告

## 当前模块

- Radar：生态雷达
- Advisor：AI 选型顾问
- Doctor：项目体检
- Weekly：生态周报

## 数据来源

- GitHub
- npm
- 官方文档
- 项目 README
- 社区维护信息
```

## 十二、完整实施方案

实施原则：

- 先做“可用的雷达产品”，再做“更自动化的 AI 系统”。
- 先保留当前 YAML 和 README 生成链路，避免一次性重写导致项目不可用。
- 数据库、AI、Cron 都按可降级设计：没有数据库时可以读静态 JSON，没有 AI Key 时可以浏览和筛选，没有 Cron 时可以手动运行采集脚本。
- 所有 AI 结论必须绑定事实证据，不能只输出模型判断。

### 阶段 0：项目基线整理

目标：把当前 awesome 列表整理成可演进的数据资产。

任务：

- 梳理 `data/resources.yaml` 当前字段、分类和生成脚本。
- 明确资源分类枚举，例如 `framework`、`ui`、`tooling`、`cloud`、`sdk`、`example`、`docs`。
- 增加雷达字段：`status`、`maintainStatus`、`riskLevel`、`useCases`、`notRecommendedFor`、`alternatives`、`evidence`。
- 扩展数据校验脚本，确保状态、风险等级、URL、分类和证据来源合法。
- 继续生成 `public/api/resources.json`，供新前端在数据库完成前使用。

交付物：

- 升级后的 YAML 数据结构。
- 数据校验规则。
- 至少 30 个核心资源完成雷达字段补充。
- README 或静态 JSON 仍能正常生成。

验收标准：

- `npm run check` 或等价校验命令可以通过。
- 每个核心资源都有推荐状态、风险等级和证据来源。
- 不依赖数据库和 AI 也能展示基础雷达数据。

### 阶段 1：Next.js 应用骨架

目标：把项目从静态资源页升级为产品化 Web 应用。

任务：

- 初始化 Next.js App Router + TypeScript。
- 接入 Tailwind CSS、shadcn/ui、lucide-react。
- 建立基础布局：顶部导航、分类筛选、搜索入口、资源列表、资源详情。
- 先从 `public/api/resources.json` 读取数据，避免数据库迁移阻塞前端。
- 增加基础页面：`/`、`/radar`、`/resources/[id]`、`/compare`、`/advisor`、`/weekly`。
- 建立统一的资源类型定义，例如 `Resource`、`ResourceSignal`、`ResourceScore`、`AiSummary`。

交付物：

- 可运行的 Next.js 应用。
- 雷达首页和资源列表页。
- 资源详情页。
- 方案对比页的静态原型。

验收标准：

- 用户可以按分类、状态、风险等级筛选资源。
- 资源详情页能展示摘要、证据、适用场景和替代方案。
- 页面在 Vercel Preview 中可以正常访问。

### 阶段 2：数据库接入与数据迁移

目标：把静态资源文件迁移为可查询、可更新的结构化数据。

推荐路径：

- MVP 如果坚持 Postgres：优先 Neon + Drizzle。
- 如果需要 Auth、Storage、后台管理：优先 Supabase。
- 如果读多写少且追求最高免费额度：评估 Turso。

建议先按 Postgres 设计，后续可根据服务商调整：

```text
resources
resource_signals
resource_scores
resource_ai_summaries
resource_alternatives
weekly_reports
advisor_sessions
```

任务：

- 配置数据库连接、Drizzle schema 和迁移命令。
- 实现 `scripts/import-yaml-to-db.ts`，把 YAML 一次性导入数据库。
- 实现资源查询服务，支持分类、状态、风险等级、关键词和分页。
- 将 `/api/resources`、`/api/resources/:id`、`/api/compare` 切换为读数据库。
- 保留静态 JSON 导出能力，作为降级和缓存数据源。

交付物：

- 数据库 schema。
- YAML 到数据库的导入脚本。
- 资源查询 API。
- 数据库版雷达页。

验收标准：

- 本地和 Vercel 环境都能连接数据库。
- 导入脚本可重复执行，避免重复插入。
- 公开页面访问不直接暴露数据库连接串。

### 阶段 3：Radar 核心产品体验

目标：让“小程序雷达”从列表变成可用的选型工具。

任务：

- 设计雷达视图：按类型、推荐状态、风险等级和适用场景分组。
- 增加资源卡片：名称、分类、推荐状态、风险等级、维护状态、AI 摘要。
- 增加详情页证据区：GitHub、npm、官网、文档、最近更新时间。
- 增加替代方案区：同类资源对比、推荐迁移方向。
- 增加对比页：Taro、uni-app、原生小程序、MPX 等核心方案横向比较。

交付物：

- `/radar` 主页面。
- `/resources/[id]` 详情页。
- `/compare` 对比页。

验收标准：

- 用户能在 3 次点击内找到推荐框架、风险项目和替代方案。
- 风险结论必须能看到证据来源。
- 移动端和桌面端都可用。

### 阶段 4：AI 摘要与选型顾问

目标：接入 AI，但让 AI 服务于事实数据和选型判断。

任务：

- 设计 AI 输出结构：`summary`、`recommendation`、`riskNotes`、`useCases`、`notRecommendedFor`、`alternatives`、`evidenceRefs`。
- 实现 `scripts/ai-summarize.ts`，为资源生成摘要和风险说明。
- 实现 `POST /api/advisor`，基于资源库、评分、证据生成上下文，再调用模型生成建议。
- 加入缓存：相同问题、同类对比、热门资源摘要优先读缓存。
- 加入限流：按 IP、会话或匿名 token 限制公开 AI 接口调用。
- 设计无 AI Key 降级逻辑：返回规则生成的结构化建议。

Advisor 回答约束：

- 必须给出推荐结论。
- 必须列出适用条件。
- 必须列出主要风险。
- 必须引用资源库中的项目和证据字段。
- 不能凭空生成不存在的资源。

交付物：

- AI 摘要生成脚本。
- `/advisor` 页面。
- `POST /api/advisor` 接口。
- AI 结果缓存表或 Redis 缓存。

验收标准：

- 能回答 5 到 10 个典型选型问题。
- 回答内容引用本地资源数据。
- 关闭 AI Key 后，基础雷达功能不受影响。

### 阶段 5：自动采集与评分

目标：让资源状态可以持续更新，而不是一次性人工维护。

任务：

- 实现 `scripts/enrich-resources.ts`，采集 GitHub repo、npm package、官网可用性和 README 信息。
- 实现 `scripts/score-resources.ts`，按规则生成维护状态、风险等级和推荐状态。
- 建立采集记录表，保留每次采集时间、来源、原始指标和错误信息。
- 用 Vercel Cron 每天触发一次轻量采集。
- 对 GitHub API、npm registry 和官网请求加超时、重试和速率控制。

评分建议：

- 最近 6 个月有提交或 release，风险降低。
- repo archived、长期无 release、issue 长期无人响应，风险升高。
- npm 包长期不发布但仍高使用量，标记为需要评估，而不是直接不推荐。
- 官方文档明确废弃或迁移时，优先提高风险等级。

交付物：

- 自动采集脚本。
- 自动评分脚本。
- Cron 入口 `/api/cron/enrich`。
- 采集日志和错误记录。

验收标准：

- Cron 每天可运行一次。
- 单次采集失败不会影响整个系统。
- 每个自动结论都能追溯到原始指标。

### 阶段 6：生态周报 Weekly

目标：把持续采集的数据转化为内容资产。

任务：

- 实现 `scripts/generate-weekly.ts`。
- 汇总本周新增资源、维护状态变化、重要 release、风险项目和推荐项目。
- 用 AI 生成周报摘要，但保留结构化数据明细。
- 周报写入数据库，并可选同步到 Vercel Blob 作为 Markdown/JSON 快照。
- 增加 `/weekly` 页面展示历史周报。

交付物：

- 周报生成脚本。
- `/weekly` 页面。
- Cron 入口 `/api/cron/weekly`。
- 周报 Markdown 或 JSON 快照。

验收标准：

- 每周可以生成一份完整周报。
- 周报能链接回具体资源和证据。
- 周报生成失败不会影响雷达主站。

### 阶段 7：Doctor 项目体检

目标：把产品从“生态选型”扩展到“项目诊断”。

任务：

- 实现 CLI 原型：`npx miniprogram-radar doctor ./my-weapp`。
- 扫描 `package.json`、`project.config.json`、框架配置、依赖、构建脚本和环境变量。
- 识别项目类型：原生、Taro、uni-app、MPX、WePY、mpvue、Remax。
- 对依赖进行风险匹配：是否停维、是否有替代方案、是否需要升级。
- 输出 Markdown 报告，可选上传到 Vercel Blob。
- 将 Doctor 报告与 Radar 资源库打通，给出具体迁移建议。

交付物：

- CLI 原型。
- Doctor 扫描规则。
- Markdown 体检报告。
- 可选的 Web 报告查看页。

验收标准：

- 能识别至少 3 类典型小程序项目。
- 能发现过时框架、停维依赖和配置风险。
- 报告包含结论、证据、优先级和修复建议。

### 阶段 8：Vercel 部署与运维

目标：让项目可以稳定运行在 Vercel 免费资源内。

任务：

- 配置 Vercel 项目、环境变量和 Preview Deployments。
- 接入数据库服务，优先 Neon 或 Supabase。
- 配置 Cron：`daily-enrich` 和 `weekly-report`。
- 配置 Blob：保存周报快照、Doctor 报告和导出文件。
- 接入 Web Analytics 和 Speed Insights。
- 为 `/api/advisor`、`/api/cron/*`、`/api/admin/*` 增加鉴权或保护。
- 建立基础监控：采集错误、AI 调用失败、数据库写入失败记录到表中。

环境变量建议：

```text
DATABASE_URL
SITE_URL
NEXT_PUBLIC_SITE_URL
OPENAI_API_KEY
GITHUB_TOKEN
CRON_SECRET
ADMIN_TOKEN
BLOB_READ_WRITE_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

交付物：

- Vercel 生产环境。
- Vercel Preview 环境。
- Cron 配置。
- 环境变量清单。
- 基础错误记录机制。

验收标准：

- 生产站点可以公开访问。
- Cron 可以成功触发并写入采集记录。
- AI 接口不会暴露密钥，且有调用限制。
- 免费额度内可以稳定运行 MVP。

### 建议里程碑

| 里程碑 | 周期 | 核心目标 | 交付物 |
| --- | --- | --- | --- |
| M0 | 第 1 周 | 数据结构升级 | 雷达字段、校验脚本、核心资源补全 |
| M1 | 第 2 周 | Web 产品原型 | Next.js、Radar 页面、资源详情页 |
| M2 | 第 3 周 | 数据库版 MVP | 数据库 schema、导入脚本、资源 API |
| M3 | 第 4 周 | AI Advisor 原型 | AI 摘要、选型问答、缓存和限流 |
| M4 | 第 5 周 | 自动采集 | GitHub/npm 采集、评分、Cron |
| M5 | 第 6 周 | 周报和部署完善 | Weekly、Blob 快照、Vercel 生产部署 |
| M6 | 后续 | Doctor 体检 | CLI、扫描规则、报告生成 |

### 首个 MVP 范围

首个版本建议只做这些：

- 30 到 50 个核心资源的雷达化数据。
- Next.js 雷达页、资源详情页、对比页。
- 数据库接入和 YAML 导入。
- AI Advisor 支持典型选型问题。
- 每日采集 GitHub/npm 基础信号。
- Vercel 部署、Cron、基础限流和缓存。

暂缓内容：

- 完整用户系统。
- 复杂后台协作。
- 实时通知。
- 大规模爬虫。
- Doctor 完整商业化报告。
- 多租户和付费能力。

### 主要风险与处理

| 风险 | 表现 | 处理方式 |
| --- | --- | --- |
| AI 成本不可控 | 公开 Advisor 被频繁调用 | 缓存、限流、登录后使用、热门问题预生成。 |
| AI 结论不可靠 | 推荐缺少证据或凭空判断 | 强制基于资源库上下文，输出 evidenceRefs。 |
| 免费数据库容量不足 | AI 摘要、日志、周报持续增长 | 摘要去重、日志保留周期、Blob 存快照、数据库只存索引。 |
| Cron 任务超时 | 采集资源过多或第三方 API 慢 | 增量采集、分页批处理、失败重试、分批队列。 |
| 数据维护成本高 | 资源状态需要大量人工修正 | 自动采集先给建议，人工只审核高风险和高热度资源。 |
| 产品仍像列表 | 页面只是换皮展示资源 | 强化状态、风险、适用场景、替代方案和 AI Advisor。 |

## 十三、成功标准

短期成功标准：

- 项目不再只是 awesome 列表，而是有明确产品定位。
- 核心资源具备推荐状态、风险等级和适用场景。
- 用户能通过网页完成筛选和初步选型。
- README 能清楚表达“小程序雷达”的新定位。

中期成功标准：

- 支持 AI 选型问答。
- 支持项目体检报告。
- 自动采集资源状态。
- 形成定期生态简报。

长期成功标准：

- 成为小程序开发者做技术选型时的参考入口。
- 能持续识别生态中过时、活跃和新兴的技术方案。
- 形成可复用的小程序技术评估数据集。
