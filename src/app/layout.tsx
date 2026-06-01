import type { Metadata, Viewport } from "next";
import { APP_LOGO_PATH, BRAND_FULL, BRAND_NAME } from "@/lib/brand";
import { BrandingProvider } from "@/components/BrandingProvider";
import { DynamicManifestLink } from "@/components/DynamicManifestLink";
import { I18nProvider } from "@/components/I18nProvider";
import { PwaShell } from "@/components/PwaShell";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_FULL,
  description: "Nutrition Coach 專屬飲食打卡同教練管理 — Coach! what to eat?",
  applicationName: BRAND_NAME,
  manifest: "/api/manifest",
    icons: {
    icon: [{ url: APP_LOGO_PATH, type: "image/png" }],
    apple: [{ url: APP_LOGO_PATH, type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND_NAME,
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
  themeColor: "#7ED321",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <body className="antialiased bg-white min-h-screen text-gray-900">
        <I18nProvider>
          <BrandingProvider>
            <DynamicManifestLink />
            {children}
            <PwaShell />
          </BrandingProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
