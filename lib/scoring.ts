import type { CheerioAPI } from "cheerio";

export type AuditItem = {
  id: string;
  title: string;
  level: "good" | "bad" | "risky" | "info";
  weight: number; // スコア配点（good=加点, bad/risky=減点）
  detail: string;
  fix?: string;
};

export type AuditResult = {
  score: number; // 0-100
  good: AuditItem[];
  bad: AuditItem[];
  risky: AuditItem[];
  info: AuditItem[];
  meta: {
    title?: string;
    description?: string;
    ogImage?: string;
    twitterImage?: string;
    finalUrl: string;
    canonical?: string;
  };
};

function clamp100(n: number) { return Math.max(0, Math.min(100, n)); }
function len(s?: string) { return s?.trim().length ?? 0; }

export async function runAudit($: CheerioAPI, finalUrl: string, robotsTxt?: string | null, sitemapXml?: string | null, psiScore?: number | null): Promise<AuditResult> {
  const items: AuditItem[] = [];
  const headTitle = $("head title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content")?.trim();
  const metaRobots = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  const h1Count = $("h1").length;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  const twitterCard = $('meta[name="twitter:card"]').attr("content")?.trim();
  const twitterImage = $('meta[name="twitter:image"]').attr("content")?.trim() || ogImage;
  const viewport = $('meta[name="viewport"]').attr("content")?.toLowerCase() ?? "";
  const lang = $("html").attr("lang")?.trim() ?? "";
  const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;
  const imagesWithoutAlt = $("img").toArray().filter(img => !($(img).attr("alt") || "").trim()).length;
  const headings = ["h1","h2","h3","h4","h5","h6"].map(s => $(s).length).reduce((a,b)=>a+b,0);
  const hasLdJson = $('script[type="application/ld+json"]').length > 0;

  // 基本メタ
  if (len(headTitle) > 0 && len(headTitle) <= 60) items.push({ id:"title-ok", title:"タイトル最適化", level:"good", weight:6, detail:`${len(headTitle)} 文字` });
  else if (len(headTitle) > 0) items.push({ id:"title-long", title:"タイトルが長すぎ/短すぎ", level:"bad", weight:-6, detail:`${len(headTitle)} 文字`, fix:"50–60 文字程度に調整してください" });
  else items.push({ id:"title-missing", title:"タイトルが欠落", level:"bad", weight:-10, detail:"<title> が見つかりません", fix:"明確なページタイトルを設定してください" });

  if (len(metaDesc) >= 50 && len(metaDesc) <= 160) items.push({ id:"desc-ok", title:"メタディスクリプション最適化", level:"good", weight:6, detail:`${len(metaDesc)} 文字` });
  else if (len(metaDesc) > 0) items.push({ id:"desc-subopt", title:"メタディスクリプションの長さが最適でない", level:"risky", weight:-3, detail:`${len(metaDesc)} 文字`, fix:"50–160 文字に調整してください" });
  else items.push({ id:"desc-missing", title:"メタディスクリプション欠落", level:"bad", weight:-8, detail:"<meta name=description> なし", fix:"検索結果でのクリック率が下がる恐れがあります。追加してください" });

  // インデックス制御
  if (metaRobots.includes("noindex")) items.push({ id:"noindex", title:"noindex 指定", level:"risky", weight:-15, detail:`robots: ${metaRobots}`, fix:"本当にインデックスさせないページか確認してください" });
  if (metaRobots.includes("nofollow")) items.push({ id:"nofollow", title:"nofollow 指定", level:"risky", weight:-4, detail:`robots: ${metaRobots}`, fix:"内部リンク評価の伝播を阻害します" });

  // 見出し
  if (h1Count === 1) items.push({ id:"h1-ok", title:"H1 見出しが 1 個", level:"good", weight:5, detail:"見出し構造が適切です" });
  else if (h1Count === 0) items.push({ id:"h1-missing", title:"H1 がない", level:"bad", weight:-6, detail:"主要トピックが不明瞭", fix:"ページの主題を示す H1 を 1 個設置してください" });
  else items.push({ id:"h1-many", title:"H1 が複数", level:"risky", weight:-3, detail:`${h1Count} 個`, fix:"原則 1 個に調整してください" });

  // カノニカル
  if (canonical) items.push({ id:"canonical", title:"カノニカル設定", level:"good", weight:4, detail:`${canonical}` });
  else items.push({ id:"canonical-missing", title:"カノニカルなし", level:"risky", weight:-3, detail:"重複対策として推奨", fix:"<link rel=canonical> を設定" });

  // モバイル
  if (viewport.includes("width=device-width")) items.push({ id:"viewport-ok", title:"モバイル対応（viewport）", level:"good", weight:4, detail:"レスポンシブ対応" });
  else items.push({ id:"viewport-missing", title:"viewport なし", level:"bad", weight:-8, detail:"モバイル UX に悪影響", fix:"<meta name=viewport content='width=device-width, initial-scale=1'> を設定" });

  // 言語・多言語
  if (lang) items.push({ id:"lang-ok", title:"言語属性", level:"good", weight:2, detail:`lang='${lang}'` });
  else items.push({ id:"lang-missing", title:"lang 属性なし", level:"risky", weight:-2, detail:"アクセシビリティ/多言語対応に影響", fix:"<html lang='ja'> などを指定" });
  if (hasHreflang) items.push({ id:"hreflang", title:"hreflang 対応", level:"info", weight:2, detail:"多言語サイトに有効" });

  // 画像 ALT
  if (imagesWithoutAlt === 0) items.push({ id:"alt-ok", title:"画像 ALT 充実", level:"good", weight:4, detail:"すべての画像が ALT あり" });
  else items.push({ id:"alt-missing", title:"ALT 欠落画像あり", level:"risky", weight:-3, detail:`ALT なし画像: ${imagesWithoutAlt} 枚`, fix:"意味のある画像には説明的 ALT を付与" });

  // 構造化データ
  if (hasLdJson) items.push({ id:"schema", title:"構造化データ (LD+JSON)", level:"good", weight:4, detail:"リッチリザルトの可能性" });

  // 見出し総数ざっくり
  if (headings < 3) items.push({ id:"headings-few", title:"見出しが少ない", level:"risky", weight:-2, detail:`合計 ${headings} 個`, fix:"H2/H3 を用いて情報構造を明確化" });

  // OG/Twitter
  if (ogImage) items.push({ id:"og-image", title:"OG 画像あり", level:"good", weight:3, detail: ogImage });
  else items.push({ id:"og-image-missing", title:"OG 画像なし", level:"risky", weight:-2, detail:"SNS シェア時の視認性が低下", fix:"<meta property='og:image'> を設定" });
  if (twitterCard) items.push({ id:"tw-card", title:"Twitter Card 指定", level:"info", weight:1, detail: twitterCard });

  // robots.txt / sitemap
  if (robotsTxt != null) items.push({ id:"robots", title:"robots.txt 応答あり", level:"info", weight:2, detail:"クロール制御を確認" });
  else items.push({ id:"robots-missing", title:"robots.txt 応答なし", level:"risky", weight:-2, detail:"クローラ制御が不明確" });

  if (sitemapXml != null) items.push({ id:"sitemap", title:"sitemap.xml 応答あり", level:"info", weight:2, detail:"インデックス促進" });
  else items.push({ id:"sitemap-missing", title:"sitemap.xml 応答なし", level:"risky", weight:-2, detail:"サイト全体の発見性に影響" });

  // PageSpeed Insights（任意）
  if (psiScore != null) {
    if (psiScore >= 90) items.push({ id:"psi-good", title:"パフォーマンス良好（PSI）", level:"good", weight:8, detail:`PSI: ${psiScore}` });
    else if (psiScore >= 50) items.push({ id:"psi-mid", title:"パフォーマンス要改善（PSI）", level:"risky", weight:-4, detail:`PSI: ${psiScore}`, fix:"LCP/CLS/JS最適化、画像の最適化、キャッシュ活用など" });
    else items.push({ id:"psi-bad", title:"パフォーマンス不良（PSI）", level:"bad", weight:-10, detail:`PSI: ${psiScore}`, fix:"クリティカルレンダリングパス・画像圧縮・遅延読み込み等を徹底" });
  }

  // 集計
  let base = 60; // 初期点（妥当な中央値）
  for (const it of items) base += it.weight;
  const score = clamp100(base);

  const good = items.filter(i => i.level === "good");
  const bad = items.filter(i => i.level === "bad");
  const risky = items.filter(i => i.level === "risky");
  const info = items.filter(i => i.level === "info");

  return {
    score,
    good, bad, risky, info,
    meta: {
      title: headTitle || undefined,
      description: metaDesc || undefined,
      ogImage: ogImage || undefined,
      twitterImage: twitterImage || undefined,
      canonical: canonical || undefined,
      finalUrl
    }
  };
}
