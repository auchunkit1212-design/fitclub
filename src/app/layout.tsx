import type { Metadata, Viewport } from "next";
import { BrandingProvider } from "@/components/BrandingProvider";
import { DynamicManifestLink } from "@/components/DynamicManifestLink";
import { PwaShell } from "@/components/PwaShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "健康管理平台",
  description: "健身房專屬飲食打卡同教練管理系統",
  applicationName: "健康管理",
  manifest: "/api/manifest",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "健康管理",
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
        <BrandingProvider>
          <DynamicManifestLink />
          {children}
          <PwaShell />
        </BrandingProvider>
      </body>
    </html>
  );
}
