import assert from "node:assert/strict";
import test from "node:test";
import { toBeijingIsoString } from "../src/time.js";

test("formats time in Asia/Shanghai with +08:00 offset", () => {
  const result = toBeijingIsoString(new Date("2026-05-19T03:30:00.000Z"));
  assert.equal(result, "2026-05-19T11:30:00+08:00");
});
