import { NextRequest, NextResponse } from "next/server";
import { fetchHtml, fetchText, normalizeUrl } from "@/lib/fetchers";
import { runAudit } from "@/lib/scoring";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const usePsi = req.nextUrl.searchParams.get("psi") === "1";
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    const { finalUrl, $, html } = await fetchHtml(url);

    // robots.txt / sitemap.xml（失敗しても続行）
    const origin = new URL(finalUrl).origin;
    const robots = await fetchText(`${origin}/robots.txt`);
    const sitemap1 = await fetchText(`${origin}/sitemap.xml`);

    // PageSpeed Insights（Google API 任意）
    let psiScore: number | null = null;
    if (usePsi) {
      const apiKey = process.env.GOOGLE_PSI_API_KEY;
      const psiUrl = new URL(PSI_ENDPOINT);
      psiUrl.searchParams.set("url", finalUrl);
      psiUrl.searchParams.set("strategy", "mobile");
      if (apiKey) psiUrl.searchParams.set("key", apiKey);

      try {
        const r = await fetch(psiUrl, { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          psiScore = Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
        }
      } catch {/* ignore PSI errors */}
    }

    const result = await runAudit($, finalUrl, robots?.ok ? robots.text! : null, sitemap1?.ok ? sitemap1.text! : null, psiScore);

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
