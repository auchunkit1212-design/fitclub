import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://fitclub.hk";

const config: CapacitorConfig = {
  appId: "hk.fitclub.nutritioncoach",
  appName: "Nutrition Coach",
  webDir: "public",
  server: {
    url: serverUrl.replace(/\/$/, ""),
    androidScheme: "https",
    allowNavigation: ["fitclub.hk", "*.fitclub.hk", "*.vercel.app"],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#059669",
    },
  },
};

export default config;
