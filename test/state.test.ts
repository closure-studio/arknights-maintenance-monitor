import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readState, writeState } from "../src/state.js";

test("returns initial state when processed file does not exist", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ak-state-"));
  try {
    const state = await readState(join(dir, "processed.json"));
    assert.deepEqual(state, { version: 1, last_check: null, processed: {} });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writes formatted state json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ak-state-"));
  const path = join(dir, "processed.json");
  try {
    await writeState(path, { version: 1, last_check: "2026-05-19T11:30:00+08:00", processed: {} });
    const content = await readFile(path, "utf8");
    assert.match(content, /"last_check": "2026-05-19T11:30:00\+08:00"/);
    assert.equal(content.endsWith("\n"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
