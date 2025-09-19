"use client";

import { useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export default function Page() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<any>(null);

  async function onAnalyze() {
    const r = await fetch(`/api/audit?url=${encodeURIComponent(url)}`);
    const data = await r.json();
    if (data.ok) setResult(data.result);
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold mb-2">SEO メタタグ解析ツール</h1>
          <p className="text-gray-600 text-sm">
            サイトの SEO タグを解析し、スコアと改善ポイントを確認できます。
          </p>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-xl shadow p-6">
          <label className="block mb-2 text-sm font-medium">URL を入力してください</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 border rounded-lg px-4 py-2"
              placeholder="https://example.com"
            />
            <button
              onClick={onAnalyze}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              解析
            </button>
          </div>
        </div>

        {/* 結果 */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* SEO 解析結果 */}
            <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center justify-center">
              <h2 className="text-lg font-semibold mb-4">SEO 解析結果</h2>
              <div style={{ width: 120, height: 120 }}>
                <CircularProgressbar
                  value={result.score}
                  text={`${result.score}`}
                  styles={buildStyles({
                    pathColor:
                      result.score >= 80
                        ? "#16a34a"
                        : result.score >= 50
                        ? "#f59e0b"
                        : "#dc2626",
                    textColor: "#111827",
                    trailColor: "#e5e7eb",
                  })}
                />
              </div>
              <p className="mt-3 text-sm text-gray-600">
                {result.score >= 80
                  ? "とても良い"
                  : result.score >= 60
                  ? "良い"
                  : "改善が必要"}
              </p>
            </div>

            {/* SEO ヘルスサマリー */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">SEO ヘルスサマリー</h2>
              <div className="space-y-2 text-sm">
                <p className="text-green-700">
                  ✅ 成功: <span className="font-bold">{result.good.length}</span>
                </p>
                <p className="text-yellow-600">
                  ⚠️ 注意: <span className="font-bold">{result.risky.length}</span>
                </p>
                <p className="text-red-600">
                  ❌ 失敗: <span className="font-bold">{result.bad.length}</span>
                </p>
              </div>
              <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-3"
                  style={{
                    width: `${
                      (result.good.length /
                        (result.good.length +
                          result.risky.length +
                          result.bad.length)) *
                        100 || 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* SEO インサイト */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">SEO インサイト</h2>
              <div className="space-y-3 text-sm">
                {/* 赤: 高優先度 */}
                {result.bad.map((b: any) => (
                  <div
                    key={b.id}
                    className="p-2 rounded border border-red-300 bg-red-50 text-red-700"
                  >
                    <span className="font-semibold">高優先度:</span> {b.title}
                    {b.fix && <div className="text-gray-600 text-xs mt-1">対策: {b.fix}</div>}
                  </div>
                ))}

                {/* 黄: 中優先度 */}
                {result.risky.map((r: any) => (
                  <div
                    key={r.id}
                    className="p-2 rounded border border-yellow-300 bg-yellow-50 text-yellow-700"
                  >
                    <span className="font-semibold">中優先度:</span> {r.title}
                    {r.fix && <div className="text-gray-600 text-xs mt-1">対策: {r.fix}</div>}
                  </div>
                ))}

                {/* 緑: 低優先度 */}
                {result.good.map((g: any) => (
                  <div
                    key={g.id}
                    className="p-2 rounded border border-green-300 bg-green-50 text-green-700"
                  >
                    <span className="font-semibold">低優先度:</span> {g.title}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
