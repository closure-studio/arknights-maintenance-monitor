import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loads safe defaults for optional NVIDIA configuration", () => {
  const originalBaseUrl = process.env.NVIDIA_BASE_URL;
  const originalModel = process.env.NVIDIA_MODEL;
  delete process.env.NVIDIA_BASE_URL;
  delete process.env.NVIDIA_MODEL;

  const config = loadConfig();

  assert.equal(config.nvidia.baseUrl, "https://integrate.api.nvidia.com/v1");
  assert.equal(config.nvidia.model, "deepseek-ai/deepseek-v4-pro");

  restoreEnv("NVIDIA_BASE_URL", originalBaseUrl);
  restoreEnv("NVIDIA_MODEL", originalModel);
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
