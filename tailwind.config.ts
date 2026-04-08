import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["GeistMono", "monospace"],
      },
      boxShadow: {
        fc: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -8px rgba(15, 23, 42, 0.08)",
        "fc-sm":
          "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
