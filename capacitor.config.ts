import type { CapacitorConfig } from "@capacitor/cli";

/** 與 src/lib/site-url.ts 嘅 DEFAULT_PUBLIC_SITE_URL 保持一致 */
const DEFAULT_PUBLIC_SITE_URL = "https://fitclub-pearl.vercel.app";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  DEFAULT_PUBLIC_SITE_URL;

const config: CapacitorConfig = {
  appId: "hk.fitclub.nutritioncoach",
  appName: "Nutrition Coach",
  webDir: "public",
  server: {
    url: serverUrl.replace(/\/$/, ""),
    androidScheme: "https",
    allowNavigation: [
      "fitclub.hk",
      "*.fitclub.hk",
      "fitclub-pearl.vercel.app",
      "*.vercel.app",
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#059669",
    },
  },
};

export default config;
