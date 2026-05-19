import { classifyWithAi } from "./classifier/ai.js";
import { classifyByRules } from "./classifier/rules.js";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { fetchNewsDetail, fetchNewsLinks } from "./news.js";
import { notifyQqbot } from "./notifier/qqbot.js";
import { readState, writeState } from "./state.js";
import { nowInBeijing } from "./time.js";
import type { ClassificationResult, NewsDetail, NotifyResult, ProcessedRecord } from "./types.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const state = await readState(config.processedPath);
  const fetchOptions = { timeoutMs: config.requestTimeoutMs, userAgent: config.userAgent };

  logger.info("Fetching news list", { url: config.newsUrl, limit: config.maxNewsItems });
  const links = await fetchNewsLinks(config.newsUrl, config.maxNewsItems, fetchOptions);
  logger.info("News links extracted", { count: links.length });

  let processedCount = 0;
  const firstSeenAt = nowInBeijing();

  for (const link of links) {
    if (state.processed[link.id]) {
      continue;
    }

    processedCount += 1;
    logger.info("Processing new announcement", { id: link.id, url: link.url });

    try {
      const detail = await fetchNewsDetail(link, fetchOptions);
      const classification = await classifyAnnouncement(detail, config.nvidia);
      const notifyResult = classification.isMaintenance
        ? await notifyQqbot(detail, classification, config.qqbot, config.requestTimeoutMs)
        : { notified: false, notifyChannel: null, notifyError: null };

      state.processed[link.id] = createRecord(detail, classification, notifyResult, firstSeenAt);
      logger.info("Announcement processed", {
        id: link.id,
        isMaintenance: classification.isMaintenance,
        notified: notifyResult.notified
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Announcement processing failed", { id: link.id, error: message });
      state.processed[link.id] = createFailureRecord(link.id, link.url, message, firstSeenAt);
    }
  }

  if (processedCount === 0) {
    logger.info("No new announcements; processed.json unchanged");
    return;
  }

  state.last_check = nowInBeijing();
  await writeState(config.processedPath, state);
  logger.info("State updated", { processedCount, path: config.processedPath });
}

async function classifyAnnouncement(
  detail: NewsDetail,
  nvidia: { apiKey?: string; baseUrl: string; model: string }
): Promise<ClassificationResult> {
  const rules = classifyByRules(detail);
  if (rules.status !== "uncertain") {
    return rules;
  }
  return classifyWithAi(detail, nvidia);
}

function createRecord(
  detail: NewsDetail,
  classification: ClassificationResult,
  notifyResult: NotifyResult,
  now: string
): ProcessedRecord {
  return {
    url: detail.url,
    title: detail.title,
    first_seen_at: now,
    last_seen_at: now,
    is_maintenance: classification.isMaintenance,
    notified: notifyResult.notified,
    notify_channel: notifyResult.notifyChannel,
    reason: classification.reason,
    summary: classification.summary,
    notify_error: notifyResult.notifyError
  };
}

function createFailureRecord(id: string, url: string, error: string, now: string): ProcessedRecord {
  return {
    url,
    title: `Failed to fetch announcement ${id}`,
    first_seen_at: now,
    last_seen_at: now,
    is_maintenance: false,
    notified: false,
    notify_channel: null,
    reason: `Announcement processing failed: ${error}`,
    summary: "单条公告处理失败，已跳过以避免阻塞整体监控。",
    notify_error: null
  };
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Monitor failed", { error: message });
  process.exitCode = 1;
});
