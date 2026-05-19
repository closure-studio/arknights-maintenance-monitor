import assert from "node:assert/strict";
import test from "node:test";
import { buildMaintenanceMessage, getMissingQqbotConfig } from "../src/notifier/qqbot.js";

test("detects missing QQBot configuration", () => {
  assert.deepEqual(getMissingQqbotConfig({}), ["QQBOT_HOST", "QQBOT_TOKEN", "QQBOT_UID"]);
});

test("builds maintenance notification message", () => {
  const message = buildMaintenanceMessage(
    {
      id: "9692",
      url: "https://ak.hypergryph.com/news/9692",
      title: "[明日方舟]05月01日06:00版本更新停机维护公告",
      content: "维护时间：2026年05月01日06:00 ~ 12:00"
    },
    {
      status: "maintenance",
      isMaintenance: true,
      reason: "标题包含停机维护关键词",
      summary: "服务器将在指定时间停机维护。",
      maintenanceStart: "2026年05月01日06:00",
      maintenanceEnd: "12:00"
    }
  );

  assert.match(message, /明日方舟停机维护提醒/);
  assert.match(message, /2026年05月01日06:00 ~ 12:00/);
  assert.match(message, /https:\/\/ak\.hypergryph\.com\/news\/9692/);
});
