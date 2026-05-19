import { logger } from "../logger.js";
import type { ClassificationResult, NewsDetail, NotifyResult } from "../types.js";

export interface QqbotConfig {
  host?: string;
  token?: string;
  uid?: string;
}

export async function notifyQqbot(
  news: NewsDetail,
  classification: ClassificationResult,
  config: QqbotConfig,
  timeoutMs: number
): Promise<NotifyResult> {
  const missing = getMissingQqbotConfig(config);
  if (missing.length > 0) {
    const message = `Missing QQBot environment variables: ${missing.join(", ")}`;
    logger.warn(message);
    return { notified: false, notifyChannel: null, notifyError: message };
  }

  const uid = Number(config.uid);
  if (!Number.isFinite(uid)) {
    const message = "QQBOT_UID must be a number";
    logger.warn(message);
    return { notified: false, notifyChannel: null, notifyError: message };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.host}/api/send_msg_auto`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: config.token,
        uid,
        msg: buildMaintenanceMessage(news, classification)
      })
    });

    const text = await response.text();
    if (!response.ok) {
      const body = text.slice(0, 300);
      const message = `QQBot API returned ${response.status}: ${body}`;
      logger.warn("QQBot notification failed", { status: response.status, body });
      return { notified: false, notifyChannel: null, notifyError: message };
    }

    return { notified: true, notifyChannel: "qqbot", notifyError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("QQBot notification request failed", { error: message });
    return { notified: false, notifyChannel: null, notifyError: `QQBot request failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildMaintenanceMessage(news: NewsDetail, classification: ClassificationResult): string {
  const start = classification.maintenanceStart || "未提取，请查看原文";
  const end = classification.maintenanceEnd || "未提取，请查看原文";
  return [
    "【明日方舟停机维护提醒】",
    "",
    "标题：",
    news.title,
    "",
    "维护时间：",
    `${start} ~ ${end}`,
    "",
    "摘要：",
    classification.summary,
    "",
    "原因：",
    classification.reason,
    "",
    "链接：",
    news.url
  ].join("\n");
}

export function getMissingQqbotConfig(config: QqbotConfig): string[] {
  const missing: string[] = [];
  if (!config.host) missing.push("QQBOT_HOST");
  if (!config.token) missing.push("QQBOT_TOKEN");
  if (!config.uid) missing.push("QQBOT_UID");
  return missing;
}
