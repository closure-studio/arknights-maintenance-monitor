import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { logger } from "../logger.js";
import type { ClassificationResult, NewsDetail } from "../types.js";

export interface AiConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
}

export interface AiJsonResponse {
  is_maintenance: boolean;
  confidence: number;
  maintenance_start: string | null;
  maintenance_end: string | null;
  reason: string;
  summary: string;
}

type NvidiaChatParams = ChatCompletionCreateParamsNonStreaming & {
  chat_template_kwargs?: {
    thinking: boolean;
  };
};

export async function classifyWithAi(news: NewsDetail, config: AiConfig): Promise<ClassificationResult> {
  if (!config.apiKey) {
    return nonMaintenance("AI skipped because NVIDIA_API_KEY is not set", news.title);
  }

  try {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });

    const params: NvidiaChatParams = {
      model: config.model,
      messages: [{ role: "user", content: buildPrompt(news) }],
      temperature: 0,
      top_p: 0.95,
      max_tokens: 1024,
      chat_template_kwargs: { thinking: false },
      stream: false
    };

    const completion = await openai.chat.completions.create(params);
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return nonMaintenance("AI returned empty content", news.title);
    }

    const parsed = parseAiJson(content);
    return {
      status: parsed.is_maintenance ? "maintenance" : "not_maintenance",
      isMaintenance: parsed.is_maintenance,
      confidence: parsed.confidence,
      maintenanceStart: parsed.maintenance_start,
      maintenanceEnd: parsed.maintenance_end,
      reason: parsed.reason,
      summary: parsed.summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("AI classification failed", { error: message });
    return nonMaintenance(`AI classification failed: ${message}`, news.title);
  }
}

export function parseAiJson(content: string): AiJsonResponse {
  const parsed = JSON.parse(content) as Partial<AiJsonResponse>;
  if (typeof parsed.is_maintenance !== "boolean") throw new Error("AI JSON missing is_maintenance");
  if (typeof parsed.confidence !== "number") throw new Error("AI JSON missing confidence");
  if (typeof parsed.reason !== "string") throw new Error("AI JSON missing reason");
  if (typeof parsed.summary !== "string") throw new Error("AI JSON missing summary");
  return {
    is_maintenance: parsed.is_maintenance,
    confidence: parsed.confidence,
    maintenance_start: typeof parsed.maintenance_start === "string" ? parsed.maintenance_start : null,
    maintenance_end: typeof parsed.maintenance_end === "string" ? parsed.maintenance_end : null,
    reason: parsed.reason,
    summary: parsed.summary
  };
}

function buildPrompt(news: NewsDetail): string {
  return [
    "你是明日方舟官网公告分类器。请判断公告是否为停机维护、版本更新停机维护或服务器维护公告。",
    "只返回 JSON，不要返回 Markdown，不要解释。",
    'JSON 格式：{"is_maintenance":boolean,"confidence":number,"maintenance_start":string|null,"maintenance_end":string|null,"reason":string,"summary":string}',
    `标题：${news.title}`,
    `正文：${news.content.slice(0, 6000)}`
  ].join("\n");
}

function nonMaintenance(reason: string, title: string): ClassificationResult {
  return {
    status: "not_maintenance",
    isMaintenance: false,
    reason,
    summary: title,
    maintenanceStart: null,
    maintenanceEnd: null
  };
}
