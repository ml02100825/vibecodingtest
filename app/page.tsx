"use client";

import { useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

type AuditItem = { id: string | number; title: string; fix?: string };
type Preview = { title?: string; description?: string; image?: string };
type AuditResult = {
  score: number;
  good: AuditItem[];
  bad: AuditItem[];
  risky: AuditItem[];
  preview?: Preview;
};

export default function Page() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const scoreToTone = (s: number) =>
    (s >= 80 ? "good" : s >= 50 ? "mid" : "bad") as "good" | "mid" | "bad";

  const circleColor = { good: "#16a34a", mid: "#f59e0b", bad: "#dc2626" } as const;
  const labelText = { good: "VeryGood", mid: "Good", bad: "bad" } as const;
  const toneCardClass = { good: "tone-good", mid: "tone-mid", bad: "tone-bad" } as const;
  const toneLabelClass = { good: "label-good", mid: "label-mid", bad: "label-bad" } as const;

  async function onAnalyze() {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await fetch(`/api/audit?url=${encodeURIComponent(url)}`);
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "解析に失敗しました");
      setResult(data.result as AuditResult);
    } catch (e: any) {
      setErr(e?.message ?? "解析に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const tone = result ? scoreToTone(result.score) : null;
  const pv: Preview = result?.preview ?? {};
  const siteHost = (() => {
    try {
      const u = url?.startsWith("http") ? url : `https://${url}`;
      return new URL(u).hostname;
    } catch {
      return url || "";
    }
  })();
  const pvTitle = pv.title || siteHost || "プレビュー";
  const pvDesc = pv.description || "説明テキストが見つかりませんでした。";
  const pvImage = pv.image || "";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <div className="container-grid">
          <main className="main-col">
            <h1 className="text-2xl font-bold text-center mb-6">SEO メタタグ解析ツール</h1>

            {/* 入力 */}
            <section className="card mb-6">
              <label className="block mb-2 text-sm font-medium">サイトURLを入力してください</label>
              <div className="stack-sm">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") onAnalyze(); }}
                  className="input-blue"
                  placeholder="https://example.com"
                />
                <button onClick={onAnalyze} disabled={loading || !url} className="btn">
                  {loading ? "解析中…" : "解析"}
                </button>
              </div>
            </section>

            {/* エラー */}
            {err && (
              <div className="card mb-6" style={{ background: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C" }}>
                {err}
              </div>
            )}

            {/* 解析結果 */}
            {result && tone && (
              <section className={`card result-card ${toneCardClass[tone]}`}>
                {/* 右上に固定：VeryGood / Good / bad */}
                <div className={`result-label ${toneLabelClass[tone]}`}>{labelText[tone]}</div>

                <h2 className="text-lg font-semibold mb-4">SEO 解析結果</h2>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10 mb-6">
                  <div style={{ width: 120, height: 120 }}>
                    <CircularProgressbar
                      value={result.score}
                      text={`${result.score}`}
                      styles={buildStyles({
                        pathColor: circleColor[tone],
                        textColor: "#111827",
                        trailColor: "#e5e7eb",
                      })}
                    />
                  </div>

                  <div className="text-sm w-full">
                    {/* ▼ 重複を解消：ここは「Passed/Warn/Failed」のみ残す ▼ */}
                    <div className="summary-grid">
                      <div className="summary-box good">✅ Passed: {result.good.length}</div>
                      <div className="summary-box warn">⚠️ Warnings: {result.risky.length}</div>
                      <div className="summary-box bad">❌ Failed: {result.bad.length}</div>
                    </div>

                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${
                            ((result.good.length + result.risky.length) /
                              (result.good.length + result.risky.length + result.bad.length || 1)) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* インサイト */}
                <div className="insight-grid">
                  <div>
                    <h3 className="font-medium mb-2">良かった点</h3>
                    {result.good.length ? (
                      result.good.map((g) => <div key={g.id} className="insight-box insight-good">{g.title}</div>)
                    ) : (
                      <p className="text-sm text-gray-500">なし</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">改善点</h3>
                    {result.bad.length || result.risky.length ? (
                      <>
                        {result.bad.map((b) => (
                          <div key={b.id} className="insight-box insight-bad">
                            {b.title} {b.fix && <span>（対策: {b.fix}）</span>}
                          </div>
                        ))}
                        {result.risky.map((r) => (
                          <div key={r.id} className="insight-box insight-warn">
                            {r.title} {r.fix && <span>（対策: {r.fix}）</span>}
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">なし</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ソーシャルプレビュー（既存のまま） */}
            {result && (
              <section className="card">
                <h2 className="text-lg font-semibold mb-4">ソーシャルプレビュー</h2>
                <div className="social-grid">
                  {/* X */}
                  <article className="social-card x-card">
                    <div className="social-title">X プレビュー</div>
                    <div className="ratio-16x9">
                      {pvImage ? <img src={pvImage} alt="X preview" className="media" /> : <div className="media-fallback">No Image</div>}
                    </div>
                    <div className="x-meta">
                      <div className="x-title">{pvTitle}</div>
                      <div className="x-desc">{pvDesc}</div>
                      <div className="x-domain">{siteHost || "example.com"}</div>
                    </div>
                  </article>

                  {/* Instagram */}
                  <article className="social-card ig-card">
                    <header className="ig-header">
                      <div className="ig-avatar" />
                      <div className="ig-name">{siteHost || "example.com"}</div>
                      <div className="ig-dots">•••</div>
                    </header>
                    <div className="ratio-1x1">
                      {pvImage ? <img src={pvImage} alt="Instagram preview" className="media" /> : <div className="media-fallback">No Image</div>}
                    </div>
                    <div className="ig-actions"><span>♡</span><span>💬</span><span>↗</span></div>
                    <div className="ig-caption">
                      <span className="ig-strong">{siteHost || "site"}</span> {pvTitle} — {pvDesc}
                    </div>
                  </article>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
