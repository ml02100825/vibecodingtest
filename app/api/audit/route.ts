import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";

type Item = { id: string; title: string; fix?: string };
type Result = {
  score: number;
  good: Item[];
  bad: Item[];
  risky: Item[];
  preview?: { title?: string; description?: string; image?: string };
};

// URL 正規化
function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    return new URL(u).toString();
  } catch {
    return u;
  }
}
function cleanText(s: string | undefined | null): string {
  return (s || "").replace(/\s+/g, " ").trim();
}
function getMeta($: cheerio.CheerioAPI, name: string): string | undefined {
  const v = $(`meta[name="${name}"]`).attr("content");
  return v ? cleanText(v) : undefined;
}
function getMetaProp($: cheerio.CheerioAPI, prop: string): string | undefined {
  const v = $(`meta[property="${prop}"]`).attr("content");
  return v ? cleanText(v) : undefined;
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ ok: false, error: "url パラメータが必要です" }, { status: 400 });
  }
  const targetUrl = normalizeUrl(urlParam);

  let html = "";
  let finalUrl = targetUrl;
  try {
    const r = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36 SEO-Inspector/1.0",
      },
    });
    finalUrl = r.url || targetUrl;
    html = await r.text();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `取得失敗: ${e?.message || e}` },
      { status: 500 }
    );
  }

  if (!html) {
    return NextResponse.json(
      { ok: false, error: "HTMLが空です" },
      { status: 502 }
    );
  }

  // cheerio で解析
  const $ = load(html);
  const good: Item[] = [];
  const bad: Item[] = [];
  const risky: Item[] = [];

  // ------------------------
  // 1. Helpful Content
  // ------------------------
  const title = cleanText($("title").first().text());
  if (title) {
    good.push({ id: "title_ok", title: "タイトルがあります" });
    if (title.length < 30) risky.push({ id: "title_short", title: "タイトルが短い", fix: "30文字以上推奨" });
    if (title.length > 65) risky.push({ id: "title_long", title: "タイトルが長い", fix: "65文字以内推奨" });
  } else {
    bad.push({ id: "title_missing", title: "タイトルがありません", fix: "titleタグを追加してください" });
  }

  const desc = getMeta($, "description");
  if (desc) {
    good.push({ id: "desc_ok", title: "メタディスクリプションがあります" });
  } else {
    risky.push({ id: "desc_missing", title: "メタディスクリプションがありません", fix: "meta descriptionを追加" });
  }

  const wordCount = cleanText($("body").text()).split(/\s+/).filter(Boolean).length;
  if (wordCount > 300) {
    good.push({ id: "content_ok", title: `十分な本文量（${wordCount}語）` });
  } else {
    risky.push({ id: "content_low", title: `本文が少ない（${wordCount}語）`, fix: "300語以上を目安に追加" });
  }

  // ------------------------
  // 2. Page Experience
  // ------------------------
  try {
    const u = new URL(finalUrl);
    if (u.protocol === "https:") {
      good.push({ id: "https_ok", title: "HTTPS対応" });
    } else {
      bad.push({ id: "https_missing", title: "HTTPS未対応", fix: "SSL証明書を設定してください" });
    }
  } catch {}

  const viewport = getMeta($, "viewport");
  if (viewport && /width=device-width/i.test(viewport)) {
    good.push({ id: "viewport_ok", title: "モバイル対応（viewport設定済み）" });
  } else {
    risky.push({ id: "viewport_missing", title: "viewportが未設定", fix: "モバイル対応 meta を追加" });
  }

  // Core Web Vitals は本当は外部APIが必要 → 簡易チェックのみ
  good.push({ id: "cwv_placeholder", title: "Core Web Vitals (要外部計測)" });

  // ------------------------
  // 3. Indexing
  // ------------------------
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) {
    good.push({ id: "canonical_ok", title: "canonicalが設定されています" });
  } else {
    risky.push({ id: "canonical_missing", title: "canonicalがありません", fix: "自己参照canonicalを追加" });
  }

  const ldjson = $('script[type="application/ld+json"]').length;
  if (ldjson > 0) {
    good.push({ id: "ldjson_ok", title: "構造化データがあります" });
  } else {
    risky.push({ id: "ldjson_missing", title: "構造化データがありません", fix: "Schema.orgを実装" });
  }

  // ------------------------
  // 4. Links
  // ------------------------
  const anchors = $("a[href]");
  if (anchors.length > 10) {
    good.push({ id: "links_ok", title: "内部リンクが適切に存在します" });
  }
  const blankAnchors = anchors.filter((_, el) => $(el).attr("target") === "_blank");
  if (blankAnchors.length > 0) {
    const safeBlank = blankAnchors.filter((_, el) =>
      /\bnoopener\b/.test($(el).attr("rel") || "")
    ).length;
    if (safeBlank !== blankAnchors.length) {
      risky.push({ id: "a_noopener", title: "noopener不足", fix: "rel=\"noopener\"を追加" });
    }
  }

  // ------------------------
  // 5. UX Signals
  // ------------------------
  if (desc && desc.length >= 50 && desc.length <= 160) {
    good.push({ id: "desc_len_ok", title: "クリックされやすいメタディスクリプション" });
  }
  if (title && title.length >= 30 && title.length <= 65) {
    good.push({ id: "title_len_ok", title: "クリックされやすいタイトル" });
  }

  // ------------------------
  // スコアリング
  // ------------------------
let score = 100;

  
// Bad は 1 個につき -10 点
for (const b of bad) {
  score -= 10;
}

// Risky は 1 個につき -5 点
for (const r of risky) {
  score -= 5;
}

// 0〜100 に制限
score = Math.max(0, Math.min(100, score));


// スコアを 0〜100 に丸める
score = Math.max(0, Math.min(100, score));


  // SNSプレビュー用
  const preview = {
    title: getMetaProp($, "og:title") || title,
    description: getMetaProp($, "og:description") || desc,
    image: getMetaProp($, "og:image"),
  };

  const result: Result = { score, good, bad, risky, preview };
  return NextResponse.json({ ok: true, result });
}
