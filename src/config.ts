import "dotenv/config";

export interface AppConfig {
  newsUrl: string;
  maxNewsItems: number;
  requestTimeoutMs: number;
  userAgent: string;
  processedPath: string;
  qqbot: {
    host?: string;
    token?: string;
    uid?: string;
  };
  nvidia: {
    apiKey?: string;
    baseUrl: string;
    model: string;
  };
}

export function loadConfig(): AppConfig {
  const qqbot: AppConfig["qqbot"] = {};
  const host = emptyToUndefined(process.env.QQBOT_HOST);
  const token = emptyToUndefined(process.env.QQBOT_TOKEN);
  const uid = emptyToUndefined(process.env.QQBOT_UID);
  if (host) qqbot.host = host;
  if (token) qqbot.token = token;
  if (uid) qqbot.uid = uid;

  const nvidia: AppConfig["nvidia"] = {
    baseUrl: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
    model: process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4-pro"
  };
  const apiKey = emptyToUndefined(process.env.NVIDIA_API_KEY);
  if (apiKey) nvidia.apiKey = apiKey;

  return {
    newsUrl: "https://ak.hypergryph.com/news",
    maxNewsItems: readPositiveInt(process.env.MAX_NEWS_ITEMS, 10),
    requestTimeoutMs: readPositiveInt(process.env.REQUEST_TIMEOUT_MS, 15_000),
    userAgent: process.env.USER_AGENT || "ak-maintenance-monitor/0.1 (+https://github.com/)",
    processedPath: process.env.PROCESSED_PATH || "processed.json",
    qqbot,
    nvidia
  };
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
