import * as cheerio from "cheerio";
import { fetchText, type FetchTextOptions } from "./http.js";
import type { NewsDetail, NewsLink } from "./types.js";

const NEWS_HOST = "ak.hypergryph.com";
const NEWS_ID_PATTERN = /\/news\/(\d+)/;

export function extractNewsLinks(html: string, baseUrl = "https://ak.hypergryph.com/news"): NewsLink[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: NewsLink[] = [];
  const addLink = (href: string): void => {
    const url = normalizeNewsUrl(href, baseUrl);
    if (!url) return;

    const id = extractNewsId(url);
    if (!id || seen.has(id)) return;

    seen.add(id);
    links.push({ id, url });
  };

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    addLink(href);
  });

  for (const match of html.matchAll(/https?:\/\/ak\.hypergryph\.com\/news\/\d+/g)) {
    addLink(match[0]);
  }

  return links;
}

export function parseNewsDetail(id: string, url: string, html: string): NewsDetail {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const rawTitle =
    $("h1").first().text().trim() ||
    $("[class*='title']").first().text().trim() ||
    $("title").first().text().trim();

  const title = normalizeText(rawTitle.replace(/\s*-\s*明日方舟\s*$/, ""));
  const mainText =
    $("article").first().text() ||
    $("main").first().text() ||
    $("[class*='content']").first().text() ||
    $("body").text();

  const content = normalizeText(mainText);
  return { id, url, title, content };
}

export function extractNewsId(url: string): string | null {
  return NEWS_ID_PATTERN.exec(url)?.[1] ?? null;
}

export async function fetchNewsLinks(listUrl: string, limit: number, options: FetchTextOptions): Promise<NewsLink[]> {
  const html = await fetchText(listUrl, options);
  return extractNewsLinks(html, listUrl).slice(0, limit);
}

export async function fetchNewsDetail(link: NewsLink, options: FetchTextOptions): Promise<NewsDetail> {
  const html = await fetchText(link.url, options);
  return parseNewsDetail(link.id, link.url, html);
}

function normalizeNewsUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.hostname !== NEWS_HOST) return null;
    const id = extractNewsId(url.pathname);
    if (!id) return null;
    return `https://${NEWS_HOST}/news/${id}`;
  } catch {
    return null;
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
