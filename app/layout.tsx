import "./globals.css";

export const metadata = {
  title: "SEO メタタグ解析ツール",
  description: "サイトのSEOタグを解析しスコア化するツール",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
