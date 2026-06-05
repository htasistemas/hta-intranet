import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A192F",
        sidebar: "#112240",
        card: "#1E2A47",
        foreground: "#E2E8F0",
        primary: "#3B82F6",
        accent: "#2DD4BF"
      },
      boxShadow: { glow: "0 12px 35px rgba(45,212,191,.12)" }
    }
  },
  plugins: []
} satisfies Config;
