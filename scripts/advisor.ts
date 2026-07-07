import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAdvisorPromptContract } from "@/lib/ai-prompts";
import { createAdvisorAnswer, type AdvisorAnswer } from "@/lib/advisor";
import { validateAdvisorAnswer } from "@/lib/ai-output-validation";
import { getResources } from "@/lib/resources";

const args = process.argv.slice(2);
const outArg = args.find((arg) => arg.startsWith("--out="));
const jsonOutput = args.includes("--json") || process.env.npm_config_json === "true";
const promptOutput = args.includes("--prompt");
const question = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();

if (!question) {
  console.error("Advisor question is required.");
  console.error('Example: miniprogram-radar advisor "React 团队做电商小程序，应该选 Taro 还是原生？"');
  console.error('Prompt contract: miniprogram-radar advisor "React 团队做电商小程序，应该选 Taro 还是原生？" --prompt');
  process.exit(1);
}

function renderAdvisorAnswer(answer: AdvisorAnswer) {
  const lines = [
    "# 小程序选型建议",
    "",
    `问题：${answer.question}`,
    "",
    "## 推荐结论",
    "",
    answer.recommendation,
    "",
    "## 适用条件",
    "",
    ...answer.fitConditions.map((item) => `- ${item}`),
    "",
    "## 推荐理由",
    "",
    ...answer.reasons.map((item) => `- ${item}`),
    "",
    "## 主要风险",
    "",
    ...answer.risks.map((item) => `- ${item}`),
    "",
    "## 替代方案",
    ""
  ];

  if (answer.alternatives.length === 0) {
    lines.push("暂无明确替代方案。");
  } else {
    for (const alternative of answer.alternatives) {
      lines.push(`- [${alternative.title}](${alternative.url})：${alternative.reason}`);
    }
  }

  lines.push("", "## 验证清单", "", ...answer.validationChecklist.map((item) => `- ${item}`), "", "## 证据来源", "");
  for (const evidence of answer.evidence) {
    lines.push(`- [${evidence.title}](${evidence.url})：${evidence.label}`);
  }

  return `${lines.join("\n").trim()}\n`;
}

const resources = await getResources();
const answer = createAdvisorAnswer(question, resources);
const validation = validateAdvisorAnswer(answer, resources);

if (!validation.ok) {
  console.error(`Advisor answer validation failed: ${validation.errors.join("; ")}`);
  process.exit(1);
}

const promptContract = promptOutput ? buildAdvisorPromptContract(question, answer, resources) : null;
const renderedOutput = promptContract ? `${JSON.stringify(promptContract, null, 2)}\n` : jsonOutput ? `${JSON.stringify(answer, null, 2)}\n` : renderAdvisorAnswer(answer);

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, renderedOutput, "utf8");
  console.log(promptContract ? `Advisor prompt contract written to ${outFile}` : jsonOutput ? `Advisor JSON answer written to ${outFile}` : `Advisor answer written to ${outFile}`);
} else {
  process.stdout.write(renderedOutput);
}
