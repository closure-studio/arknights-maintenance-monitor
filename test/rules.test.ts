import assert from "node:assert/strict";
import test from "node:test";
import { classifyByRules, extractMaintenanceTime } from "../src/classifier/rules.js";

test("classifies https://ak.hypergryph.com/news/9692 style title as maintenance", () => {
  const result = classifyByRules({
    title: "[明日方舟]05月01日06:00版本更新停机维护公告",
    content: "维护时间：2026年05月01日06:00 ~ 12:00 更新说明：维护期间无法登录游戏。"
  });

  assert.equal(result.status, "maintenance");
  assert.equal(result.isMaintenance, true);
  assert.equal(result.maintenanceStart, "2026年05月01日06:00");
  assert.equal(result.maintenanceEnd, "12:00");
});

test("classifies ordinary activity announcements as not maintenance", () => {
  const result = classifyByRules({
    title: "[明日方舟]限时活动公告",
    content: "活动期间将开放限时活动和礼包。"
  });

  assert.equal(result.status, "not_maintenance");
  assert.equal(result.isMaintenance, false);
});

test("extracts month-day maintenance time range", () => {
  assert.deepEqual(extractMaintenanceTime("维护时间：3月10日 06:00 - 12:00"), {
    start: "3月10日06:00",
    end: "12:00",
    raw: "3月10日 06:00 - 12:00"
  });
});
