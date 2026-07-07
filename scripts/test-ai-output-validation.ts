import assert from "node:assert/strict";
import { buildAdvisorPromptContract, buildResourceSummaryPromptContract } from "@/lib/ai-prompts";
import { createResourceAiSummaries, filterValidResourceAiSummaries } from "@/lib/ai-summaries";
import { validateAdvisorAnswer, validateGeneratedAiSummaries, validateGeneratedAiSummary } from "@/lib/ai-output-validation";
import { createAdvisorAnswer } from "@/lib/advisor";
import { getResources } from "@/lib/resources";

const resources = await getResources();
assert.ok(resources.length > 0, "resources should be available");

const summaries = createResourceAiSummaries(resources, 20);
const summaryValidation = validateGeneratedAiSummaries(summaries, resources);
assert.equal(summaryValidation.ok, true, summaryValidation.errors.join("\n"));
assert.ok(summaries.every((summary) => summary.useCases.length > 0), "generated summaries should include use cases");
assert.ok(
  summaries.some((summary) => summary.notRecommendedFor.length > 0),
  "generated summaries should include not recommended conditions when source resource or risk signals provide them"
);

const invalidSummary = {
  ...summaries[0],
  evidenceRefs: [
    {
      type: "website",
      label: "fabricated",
      url: "https://example.invalid/fabricated-evidence"
    }
  ]
};
const invalidSummaryValidation = validateGeneratedAiSummary(invalidSummary, resources);
assert.equal(invalidSummaryValidation.ok, false, "fabricated summary evidence should be rejected");
assert.match(invalidSummaryValidation.errors.join("\n"), /not present on the source resource/);
assert.deepEqual(filterValidResourceAiSummaries([summaries[0], invalidSummary], resources), [summaries[0]], "invalid summary evidence should be filtered before API output");

const invalidUseCaseValidation = validateGeneratedAiSummary(
  {
    ...summaries[0],
    useCases: ["fabricated use case"]
  },
  resources
);
assert.equal(invalidUseCaseValidation.ok, false, "fabricated summary use cases should be rejected");
assert.match(invalidUseCaseValidation.errors.join("\n"), /use case is not present on the source resource/);

const advisorAnswer = createAdvisorAnswer("React 团队做电商小程序，后续可能上 H5，应该选 Taro 还是原生？", resources);
const advisorValidation = validateAdvisorAnswer(advisorAnswer, resources);
assert.equal(advisorValidation.ok, true, advisorValidation.errors.join("\n"));

const advisorPrompt = buildAdvisorPromptContract(advisorAnswer.question, advisorAnswer, resources);
assert.equal(advisorPrompt.task, "advisor");
assert.equal(advisorPrompt.mode, "model-ready");
assert.ok(advisorPrompt.allowedResourceIds.length > 0, "advisor prompt should include allowed resources");
assert.ok(advisorPrompt.allowedEvidenceUrls.length > 0, "advisor prompt should include allowed evidence URLs");
assert.ok(advisorPrompt.messages.every((message) => !message.content.includes("OPENAI_API_KEY")), "advisor prompt must not include secret names or values");
assert.ok(
  advisorAnswer.evidence.every((evidence) => advisorPrompt.allowedEvidenceUrls.includes(evidence.url)),
  "advisor prompt should allow every validated evidence URL"
);

const summaryPrompt = buildResourceSummaryPromptContract(resources[0], summaries[0]);
assert.equal(summaryPrompt.task, "resource-summary");
assert.deepEqual(summaryPrompt.allowedResourceIds, [resources[0].id]);
assert.ok(summaryPrompt.allowedEvidenceUrls.includes(resources[0].url), "summary prompt should allow the resource homepage");
const summaryPromptSchema = JSON.stringify(summaryPrompt.outputSchema);
assert.ok(summaryPromptSchema.includes("evidenceRefs"), "summary prompt schema should require evidence refs");
assert.ok(summaryPromptSchema.includes("useCases"), "summary prompt schema should require use cases");
assert.ok(summaryPromptSchema.includes("notRecommendedFor"), "summary prompt schema should include not recommended conditions");

const invalidAdvisorValidation = validateAdvisorAnswer(
  {
    ...advisorAnswer,
    evidence: [
      {
        resourceId: advisorAnswer.evidence[0].resourceId,
        title: "fabricated",
        url: "https://example.invalid/fabricated-advisor-evidence",
        type: "website",
        label: "fabricated"
      }
    ]
  },
  resources
);
assert.equal(invalidAdvisorValidation.ok, false, "fabricated advisor evidence should be rejected");
assert.match(invalidAdvisorValidation.errors.join("\n"), /not present in the resource catalog/);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 9,
      assertions: [
        "summary evidence",
        "summary use cases",
        "summary fabricated evidence rejection",
        "summary fabricated use case rejection",
        "summary invalid evidence filtering",
        "advisor evidence",
        "advisor fabricated evidence rejection",
        "advisor prompt contract",
        "resource summary prompt contract"
      ]
    },
    null,
    2
  )
);
