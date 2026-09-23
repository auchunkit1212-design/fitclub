import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/components/I18nProvider";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "食咩好 · What to Eat",
  description:
    "Nutrition Coach 姊妹 app：一星期餐單建議，外食同煮食，依身高體重同飲食偏好。",
  applicationName: "食咩好",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "食咩好",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans">
        <I18nProvider>
          <RegisterSW />
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
