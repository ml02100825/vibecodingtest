import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";

export type FetchResult = {
  finalUrl: string;
  html: string;
  $: CheerioAPI;
};

export async function fetchHtml(target: string): Promise<FetchResult> {
  const url = normalizeUrl(target);
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "SEO-Inspector/1.0 (+https://example.com; contact: audit@example.com)"
    },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  return { finalUrl: res.url, html, $ };
}

export function normalizeUrl(u: string): string {
  try {
    const hasScheme = /^https?:\/\//i.test(u);
    const url = new URL(hasScheme ? u : `https://${u}`);
    return url.toString();
  } catch {
    throw new Error("URL が不正です");
  }
}

export async function fetchText(url: string): Promise<{ ok: boolean; text?: string; status?: number }> {
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, text };
  } catch {
    return { ok: false };
  }
}
