import type { GeneratedAiSummary } from "@/lib/ai-summaries";
import type { AdvisorAnswer } from "@/lib/advisor";
import type { RadarResource } from "@/lib/resources";

export interface AiOutputValidationResult {
  ok: boolean;
  errors: string[];
}

function result(errors: string[]): AiOutputValidationResult {
  return { ok: errors.length === 0, errors };
}

function resourceEvidenceUrls(resource: RadarResource) {
  return new Set([resource.url, ...resource.radar.evidence.map((evidence) => evidence.url)]);
}

export function validateGeneratedAiSummary(summary: GeneratedAiSummary, resources: RadarResource[]): AiOutputValidationResult {
  const errors: string[] = [];
  const resource = resources.find((item) => item.id === summary.resourceId);

  if (!resource) {
    errors.push(`${summary.resourceId}: summary references an unknown resource.`);
    return result(errors);
  }

  if (!summary.title.trim()) errors.push(`${summary.resourceId}: title is required.`);
  if (!summary.summary.trim()) errors.push(`${summary.resourceId}: summary is required.`);
  if (!summary.recommendation.trim()) errors.push(`${summary.resourceId}: recommendation is required.`);
  if (summary.riskNotes.length === 0) errors.push(`${summary.resourceId}: at least one risk note is required.`);
  if (summary.useCases.length === 0) errors.push(`${summary.resourceId}: at least one use case is required.`);
  if (summary.evidenceRefs.length === 0) errors.push(`${summary.resourceId}: at least one evidence reference is required.`);

  for (const useCase of summary.useCases) {
    if (!resource.radar.useCases.includes(useCase)) {
      errors.push(`${summary.resourceId}: use case is not present on the source resource: ${useCase}`);
    }
  }

  for (const item of summary.notRecommendedFor) {
    if (!item.trim()) errors.push(`${summary.resourceId}: notRecommendedFor entries must not be empty.`);
  }

  const allowedEvidenceUrls = resourceEvidenceUrls(resource);
  for (const evidence of summary.evidenceRefs) {
    if (!evidence.label.trim()) errors.push(`${summary.resourceId}: evidence label is required.`);
    if (!allowedEvidenceUrls.has(evidence.url)) {
      errors.push(`${summary.resourceId}: evidence URL is not present on the source resource: ${evidence.url}`);
    }
  }

  return result(errors);
}

export function validateGeneratedAiSummaries(summaries: GeneratedAiSummary[], resources: RadarResource[]): AiOutputValidationResult {
  return result(summaries.flatMap((summary) => validateGeneratedAiSummary(summary, resources).errors));
}

export function validateAdvisorAnswer(answer: AdvisorAnswer, resources: RadarResource[]): AiOutputValidationResult {
  const errors: string[] = [];
  const knownEvidenceUrls = new Set(resources.flatMap((resource) => [...resourceEvidenceUrls(resource)]));
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));

  if (!answer.question.trim()) errors.push("advisor question is required.");
  if (!answer.recommendation.trim()) errors.push("advisor recommendation is required.");
  if (answer.reasons.length === 0) errors.push("advisor answer requires at least one reason.");
  if (answer.risks.length === 0) errors.push("advisor answer requires at least one risk.");
  if (answer.evidence.length === 0) errors.push("advisor answer requires at least one evidence item.");

  for (const alternative of answer.alternatives) {
    const resource = resourcesById.get(alternative.resourceId);
    if (!resource) {
      errors.push(`advisor alternative references an unknown resource: ${alternative.resourceId}`);
      continue;
    }
    if (alternative.url !== resource.url) {
      errors.push(`advisor alternative URL does not match resource ${alternative.resourceId}: ${alternative.url}`);
    }
  }

  for (const evidence of answer.evidence) {
    const resource = resourcesById.get(evidence.resourceId);
    if (!resource) {
      errors.push(`advisor evidence references an unknown resource: ${evidence.resourceId}`);
      continue;
    }
    if (!evidence.title.trim()) errors.push("advisor evidence title is required.");
    if (!evidence.label.trim()) errors.push(`advisor evidence label is required for ${evidence.title}.`);
    if (!resourceEvidenceUrls(resource).has(evidence.url) || !knownEvidenceUrls.has(evidence.url)) {
      errors.push(`advisor evidence URL is not present in the resource catalog: ${evidence.url}`);
    }
  }

  return result(errors);
}
