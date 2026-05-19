import { readFile, rename, writeFile } from "node:fs/promises";
import type { ProcessedState } from "./types.js";

export function createInitialState(): ProcessedState {
  return {
    version: 1,
    last_check: null,
    processed: {}
  };
}

export async function readState(path: string): Promise<ProcessedState> {
  try {
    const content = await readFile(path, "utf8");
    const parsed = JSON.parse(content) as ProcessedState;
    if (parsed.version !== 1 || typeof parsed.processed !== "object" || parsed.processed === null) {
      throw new Error("Invalid processed.json structure");
    }
    return parsed;
  } catch (error) {
    if (isNotFound(error)) {
      return createInitialState();
    }
    throw error;
  }
}

export async function writeState(path: string, state: ProcessedState): Promise<void> {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
