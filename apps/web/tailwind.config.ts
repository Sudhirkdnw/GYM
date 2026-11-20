import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        card: "var(--bg-card)",
        elevated: "var(--bg-elevated)",
        popover: "var(--bg-popover)",
        subtle: "var(--border-subtle)",
        prominent: "var(--border-prominent)",
        primary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        glow: "0 0 20px -5px var(--accent-glow)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        "card-dark": "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
