export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    log("INFO", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    log("WARN", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>): void {
    log("ERROR", message, meta);
  }
};

function log(level: "INFO" | "WARN" | "ERROR", message: string, meta?: Record<string, unknown>): void {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${level}] ${message}${suffix}`);
}
