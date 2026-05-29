import type { Metadata, Viewport } from "next";
import { PwaShell } from "@/components/PwaShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitClub 健康管理",
  description: "連鎖 Gym 房專屬飲食打卡同教練管理系統",
  applicationName: "FitClub",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FitClub",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <body className="antialiased bg-zinc-50 min-h-screen">
        {children}
        <PwaShell />
      </body>
    </html>
  );
}
