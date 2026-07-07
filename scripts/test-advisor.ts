import assert from "node:assert/strict";
import { POST as advisorRoute } from "@/app/api/advisor/route";
import { createAdvisorAnswer } from "@/lib/advisor";
import { validateAdvisorAnswer } from "@/lib/ai-output-validation";
import { getResources } from "@/lib/resources";

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL
};

function setEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name as string] = value;
  }
}

const questions = [
  {
    question: "React 团队做电商小程序，后续可能上 H5，应该选 Taro 还是原生？",
    expectedEvidence: /taro|uni-app|mpx/i
  },
  {
    question: "现在还建议新项目继续使用 WePY 吗？",
    expectedRecommendation: /不建议/,
    expectedEvidence: /wepy/i
  },
  {
    question: "企业项目要选小程序 UI 组件库，Vant Weapp、TDesign、WeUI 怎么看？",
    expectedEvidence: /vant|tdesign|weui/i
  },
  {
    question: "Vue 团队要做多端小程序和 H5，uni-app 是否合适？",
    expectedEvidence: /uni-app|taro/i
  },
  {
    question: "需要云开发、serverless 或后端服务，小程序生态里有哪些方向？",
    expectedEvidence: /cloud|云|serverless|开发/i
  },
  {
    question: "要找支付、登录、地图相关 SDK，应该先看哪些资源？",
    expectedEvidence: /sdk|支付|登录|地图|map/i
  }
];

try {
  setEnv("DATABASE_URL", undefined);
  setEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  setEnv("UPSTASH_REDIS_REST_URL", undefined);

  const resources = await getResources();
  const resourceIds = new Set(resources.map((resource) => resource.id));
  const results = questions.map((item) => {
    const answer = createAdvisorAnswer(item.question, resources);
    const validation = validateAdvisorAnswer(answer, resources);
    const evidenceText = answer.evidence.map((evidence) => `${evidence.title} ${evidence.label} ${evidence.type} ${evidence.url}`).join("\n");

    assert.equal(validation.ok, true, validation.errors.join("\n"));
    assert.ok(answer.recommendation.length > 0, `${item.question} should include a recommendation`);
    assert.ok(answer.fitConditions.length > 0, `${item.question} should include fit conditions`);
    assert.ok(answer.reasons.length > 0, `${item.question} should include reasons`);
    assert.ok(answer.risks.length > 0, `${item.question} should include risks`);
    assert.ok(answer.alternatives.length > 0, `${item.question} should include alternatives`);
    assert.ok(
      answer.alternatives.every(
        (alternative) => alternative.resourceId && resourceIds.has(alternative.resourceId) && alternative.title && alternative.url && alternative.reason && alternative.status && alternative.riskLevel
      ),
      `${item.question} alternatives should include a known resource id, title, url, reason, status and risk level`
    );
    assert.ok(answer.validationChecklist.length > 0, `${item.question} should include a validation checklist`);
    assert.ok(answer.evidence.length > 0, `${item.question} should include evidence`);
    assert.ok(
      answer.evidence.every((evidence) => evidence.resourceId && resourceIds.has(evidence.resourceId) && evidence.title && evidence.url && evidence.type && evidence.label),
      `${item.question} evidence should include a known resource id, title, url, type and label`
    );
    assert.match(evidenceText, item.expectedEvidence, `${item.question} evidence should match expected topic`);

    if (item.expectedRecommendation) {
      assert.match(answer.recommendation, item.expectedRecommendation, `${item.question} recommendation should match expected stance`);
    }

    return {
      question: item.question,
      recommendation: answer.recommendation,
      evidence: answer.evidence.map((evidence) => evidence.title)
    };
  });

  const routeResponse = await advisorRoute(
    new Request("https://example.com/api/advisor", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.50"
      },
      body: JSON.stringify({ question: questions[0].question })
    })
  );
  assert.equal(routeResponse.status, 200, "advisor route should return a validated answer");
  const routeAnswer = (await routeResponse.json()) as ReturnType<typeof createAdvisorAnswer> & { cached?: boolean; persisted?: boolean };
  const routeValidation = validateAdvisorAnswer(routeAnswer, resources);
  assert.equal(routeValidation.ok, true, routeValidation.errors.join("\n"));
  assert.ok(routeAnswer.fitConditions.length > 0, "advisor route should return fit conditions");
  assert.ok(routeAnswer.alternatives.length > 0, "advisor route should return alternatives");
  assert.ok(routeAnswer.validationChecklist.length > 0, "advisor route should return a validation checklist");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: results.length + 1,
        assertions: ["advisor generation", "advisor decision structure", "advisor internal resource links", "advisor evidence validation", "advisor route validation"],
        results
      },
      null,
      2
    )
  );
} finally {
  setEnv("DATABASE_URL", originalEnv.DATABASE_URL);
  setEnv("UPSTASH_REDIS_REST_TOKEN", originalEnv.UPSTASH_REDIS_REST_TOKEN);
  setEnv("UPSTASH_REDIS_REST_URL", originalEnv.UPSTASH_REDIS_REST_URL);
}
