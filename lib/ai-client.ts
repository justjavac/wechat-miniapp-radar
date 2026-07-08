import { getAiConfig, type AiConfig } from "@/lib/ai-config";
import type { AiPromptMessage } from "@/lib/ai-prompts";

export interface AiJsonCompletionResult<T> {
  ok: boolean;
  value: T | null;
  model: string | null;
  fallbackUsed: boolean;
  error: string | null;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: unknown;
}

const DEFAULT_AI_TIMEOUT_MS = 4_000;
const DEFAULT_AI_MAX_TOKENS = 1400;

function completionUrl(config: AiConfig) {
  return `${config.apiUrl}/chat/completions`;
}

function openRouterHeaders(config: AiConfig): Record<string, string> {
  if (config.provider !== "openrouter") return {};

  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return {
    ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
    "X-Title": "MiniProgram Radar"
  };
}

async function fetchTextWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function stringifyProviderError(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "message" in value && typeof value.message === "string") {
    return value.message;
  }
  return null;
}

function extractJsonText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return trimmed;
}

function parseJsonObject<T>(text: string): T {
  const parsed = JSON.parse(extractJsonText(text)) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("AI response JSON must be an object.");
  }
  return parsed as T;
}

function parseCompletionPayload(text: string) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ChatCompletionResponse;
  } catch {
    return null;
  }
}

async function requestChatCompletion<T>({
  config,
  model,
  messages,
  timeoutMs
}: {
  config: AiConfig;
  model: string;
  messages: AiPromptMessage[];
  timeoutMs: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const { response, text } = await fetchTextWithTimeout(
    completionUrl(config),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...openRouterHeaders(config)
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: DEFAULT_AI_MAX_TOKENS,
        stream: false
      })
    },
    timeoutMs
  );

  const payload = parseCompletionPayload(text);
  if (!response.ok) {
    const providerError = stringifyProviderError(payload?.error);
    throw new Error(providerError ? `AI provider rejected ${model}: ${providerError}` : `AI provider rejected ${model} with HTTP ${response.status}.`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error(`AI provider returned an empty response for ${model}.`);
  }

  return parseJsonObject<T>(content);
}

export async function createAiJsonCompletion<T>({
  messages,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS
}: {
  messages: AiPromptMessage[];
  timeoutMs?: number;
}): Promise<AiJsonCompletionResult<T>> {
  const config = getAiConfig();
  if (!config.configured) {
    return {
      ok: false,
      value: null,
      model: null,
      fallbackUsed: false,
      error: "AI is not configured."
    };
  }

  const models = Array.from(new Set([config.model, config.fallbackModel].filter(Boolean)));
  const errors: string[] = [];

  for (const model of models) {
    try {
      const value = await requestChatCompletion<T>({
        config,
        model,
        messages,
        timeoutMs
      });
      return {
        ok: true,
        value,
        model,
        fallbackUsed: model !== config.model,
        error: null
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    ok: false,
    value: null,
    model: null,
    fallbackUsed: models.length > 1,
    error: errors.join(" | ") || "AI provider did not return a usable JSON response."
  };
}
