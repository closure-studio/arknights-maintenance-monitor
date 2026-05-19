import type { ClassificationResult, MaintenanceTime, NewsDetail } from "../types.js";

const EXCLUSION_KEYWORDS = ["活动公告", "寻访公告", "时装", "组合包", "礼包", "通讯", "限时活动"];

export function classifyByRules(news: Pick<NewsDetail, "title" | "content">): ClassificationResult {
  const title = news.title;
  const content = news.content;
  const maintenanceTime = extractMaintenanceTime(content);

  if (title.includes("版本更新停机维护") || title.includes("停机维护")) {
    return maintenanceResult("标题包含停机维护关键词", title, content, maintenanceTime);
  }

  if (content.includes("维护时间") && content.includes("无法登录")) {
    return maintenanceResult("正文包含维护时间和无法登录", title, content, maintenanceTime);
  }

  if (content.includes("停机维护") && content.includes("维护期间")) {
    return maintenanceResult("正文包含停机维护和维护期间", title, content, maintenanceTime);
  }

  const exclusion = EXCLUSION_KEYWORDS.find((keyword) => title.includes(keyword) || content.includes(keyword));
  if (exclusion) {
    return {
      status: "not_maintenance",
      isMaintenance: false,
      reason: `命中普通公告排除词：${exclusion}`,
      summary: summarize(title, content),
      maintenanceStart: null,
      maintenanceEnd: null
    };
  }

  return {
    status: "uncertain",
    isMaintenance: false,
    reason: "规则无法确定公告类型",
    summary: summarize(title, content),
    maintenanceStart: null,
    maintenanceEnd: null
  };
}

export function extractMaintenanceTime(content: string): MaintenanceTime {
  const normalized = content.replace(/\s+/g, " ").trim();
  const labeled = /维护时间[:：]\s*([^。；;\n]+?)(?:更新说明|维护补偿|开服时间|$)/.exec(normalized);
  const source = labeled?.[1]?.trim() || normalized;

  const fullDate = /(\d{4}年\s*\d{1,2}月\s*\d{1,2}日\s*\d{1,2}:\d{2})\s*(?:~|-|至|—|－)\s*(\d{1,2}:\d{2})/.exec(source);
  if (fullDate?.[1] && fullDate[2]) {
    return { start: compactChineseTime(fullDate[1]), end: fullDate[2], raw: fullDate[0].trim() };
  }

  const monthDate = /(\d{1,2}月\s*\d{1,2}日\s*\d{1,2}:\d{2})\s*(?:~|-|至|—|－)\s*(\d{1,2}:\d{2})/.exec(source);
  if (monthDate?.[1] && monthDate[2]) {
    return { start: compactChineseTime(monthDate[1]), end: monthDate[2], raw: monthDate[0].trim() };
  }

  if (labeled?.[1]) {
    return { start: labeled[1].trim(), end: null, raw: labeled[1].trim() };
  }

  return { start: null, end: null, raw: null };
}

function maintenanceResult(reason: string, title: string, content: string, time: MaintenanceTime): ClassificationResult {
  return {
    status: "maintenance",
    isMaintenance: true,
    reason,
    summary: summarize(title, content),
    maintenanceStart: time.start,
    maintenanceEnd: time.end
  };
}

function summarize(title: string, content: string): string {
  const text = content || title;
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function compactChineseTime(value: string): string {
  return value.replace(/\s+/g, "");
}
