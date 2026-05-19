export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bodySnippet?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface FetchTextOptions {
  timeoutMs: number;
  userAgent: string;
}

export async function fetchText(url: string, options: FetchTextOptions): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": options.userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(`Request failed with status ${response.status}`, response.status, text.slice(0, 300));
    }
    return text;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpError(`Request failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}
