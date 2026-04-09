import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

// モダンな日本語サンセリフ
const notoSansJp = Noto_Sans_JP({
  variable: "--font-sans-jp",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "DUSTALK AIエージェント",
  description: "ゴミ回収の申し込みを、静かに、丁寧に。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
