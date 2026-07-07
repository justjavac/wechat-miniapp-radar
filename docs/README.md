# 小程序雷达文档索引

本文档目录只保留后续实施需要长期维护的核心文档。遇到方案冲突时，以“实施总方案”和“实施追踪表”为准。

| 文档 | 用途 | 维护方式 |
| --- | --- | --- |
| [产品方案](./miniprogram-radar-product.md) | 定义产品定位、用户、模块、AI 能力和商业化方向 | 产品范围变化时更新 |
| [实施总方案](./miniprogram-radar-master-implementation-plan.md) | 指导从本地、Vercel、数据库、Cron、Redis、Blob 到 AI 的完整实施 | 架构、阶段、验收标准变化时更新 |
| [Vercel 生产方案](./miniprogram-radar-vercel-production-plan.md) | 记录 Vercel 上线、环境变量、免费资源和生产验证流程 | 生产部署流程或平台能力变化时更新 |
| [实施追踪表](./miniprogram-radar-implementation-tracker.md) | 跟踪当前进度、问题、风险、验证证据和下一步 | 每次推进实施后更新 |

## 执行顺序

1. 先读产品方案，确认“小程序雷达”的范围和不做事项。
2. 按实施总方案推进本地、部署、数据库、Cron、Redis、Blob、Admin 和 AI。
3. 部署到 Vercel 时使用 Vercel 生产方案作为 Runbook。
4. 每完成一个阶段，更新实施追踪表里的状态、证据和下一步。

## 文档清理原则

- 不再维护多份重复的实施方案。
- 不把临时讨论、聊天结论和过时阶段计划作为长期入口。
- 新增能力必须同时更新对应的验收命令或验证证据。
- 真实 AI、生产数据库、Blob、Redis、Cron 等外部能力必须以线上验证结果为准。
