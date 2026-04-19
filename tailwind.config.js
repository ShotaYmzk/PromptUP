/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "var(--color-bg-base)",
          raised: "var(--color-bg-raised)",
          hover: "var(--color-bg-hover)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          muted: "var(--color-surface-muted)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        brand: {
          DEFAULT: "var(--color-brand)",
          hover: "var(--color-brand-hover)",
          fg: "var(--color-brand-fg)",
        },
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        warn: "var(--color-warn)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Hiragino Sans'",
          "'Yu Gothic UI'",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        popup: "0 12px 32px -12px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
