import assert from "node:assert/strict";
import test from "node:test";
import { classifyWithAi, parseAiJson } from "../src/classifier/ai.js";

test("parses valid AI JSON response", () => {
  assert.deepEqual(
    parseAiJson(JSON.stringify({
      is_maintenance: true,
      confidence: 0.98,
      maintenance_start: "2026-05-01 06:00",
      maintenance_end: "2026-05-01 12:00",
      reason: "维护公告",
      summary: "停机维护"
    })),
    {
      is_maintenance: true,
      confidence: 0.98,
      maintenance_start: "2026-05-01 06:00",
      maintenance_end: "2026-05-01 12:00",
      reason: "维护公告",
      summary: "停机维护"
    }
  );
});

test("skips AI when NVIDIA_API_KEY is not set", async () => {
  const result = await classifyWithAi(
    {
      id: "1",
      url: "https://ak.hypergryph.com/news/1",
      title: "未知公告",
      content: "未知内容"
    },
    {
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: "deepseek-ai/deepseek-v4-pro"
    }
  );

  assert.equal(result.status, "not_maintenance");
  assert.equal(result.reason, "AI skipped because NVIDIA_API_KEY is not set");
});
