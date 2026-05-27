import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "健身飲食追蹤",
  description: "白標健身飲食追蹤 SaaS（Mock 版）",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
