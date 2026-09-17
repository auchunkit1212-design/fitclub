import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1a2e28",
          soft: "#3d524a",
          muted: "#6b7f76",
        },
        leaf: {
          DEFAULT: "#2d6a4f",
          bright: "#40916c",
          deep: "#1b4332",
          mist: "#d8f3dc",
        },
        sand: {
          DEFAULT: "#f7f3eb",
          warm: "#efe6d6",
        },
        coral: {
          DEFAULT: "#c45c26",
          soft: "#f4e0d4",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "plan-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "wizard-slide": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s ease-out both",
        "plan-pulse": "plan-pulse 1.4s ease-in-out infinite",
        "wizard-slide": "wizard-slide 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
