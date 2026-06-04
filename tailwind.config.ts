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
        brand: {
          primary: "#059669",
          "primary-hover": "#047857",
          "primary-dark": "#065f46",
          "primary-light": "#ecfdf5",
        },
      },
    },
  },
  plugins: [],
};

export default config;
