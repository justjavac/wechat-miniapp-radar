import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  API_FILE,
  CATALOG_JSON_FILE,
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
    "## 线上地址",
    "",
    "- 主站：<https://miniapp.denohub.com>",
    "",
    "## 适合谁",
    "",
    "- 正在做微信小程序技术选型的产品、研发和架构团队。",
    "- 需要判断 Taro、uni-app、原生小程序、组件库、云开发和 SDK 风险的团队。",
    "- 需要把历史 awesome 列表转成可筛选、可对比、可验证技术雷达的维护者。",
    "",
    "## 可以做什么",
    "",
    "- Radar：按推荐状态、风险等级、资源类型、分类和适用场景浏览小程序生态资源。",
    "- Quick Search：快速搜索资源并跳转常用页面。",
    "- Compare：对比 Taro、uni-app、原生小程序等核心方案。",
    "- Advisor：输入选型问题，获得推荐结论、适用/不适用条件、迁移成本、下一步和证据来源。",
    "- Doctor：粘贴小程序项目配置，识别框架依赖、过时方案和迁移风险。",
    "- Weekly：查看小程序生态周报和近期风险信号。",
    "",
    "## 数据概览",
    "",
    `当前数据集中包含 ${resources.length} 个小程序生态资源。完整资源可在 Radar 页面和导出能力中查看。`,
    "",
    "| 分类 | 资源数 |",
    "| --- | ---: |",
    categoryRows,
    "",
    "## 核心样例",
    "",
    ...showcaseResources,
    "",
    "## 使用入口",
    "",
    "- Radar 页面：`/radar`",
    "- Compare 页面：`/compare`",
    "- Advisor 页面：`/advisor`",
    "- Doctor 页面：`/doctor`",
    "- Weekly 页面：`/weekly`",
    "",
    "## QQ交流群",
    "",
    ...(catalog.qqGroups ?? []).map((group) => `- [${group.name}](${group.url})：${group.note}`),
    "",
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
const catalogJsonChanged = await writeIfChanged(CATALOG_JSON_FILE, `${JSON.stringify(catalog, null, 2)}\n`, check);
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
  console.log(`Generated ${CATALOG_JSON_FILE}${catalogJsonChanged ? "" : " (unchanged)"}`);
}
