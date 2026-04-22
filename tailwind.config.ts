import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app:             "#F5F5F5",
        surface:         "#FFFFFF",
        "surface-2":     "#F3F4F6",
        "surface-3":     "#E5E7EB",
        border:          "#E5E7EB",
        "border-strong": "#D1D5DB",
        muted:           "#6B7280",
        accent:          "#2563EB",
        "accent-2":      "#1D4ED8",
        text:            "#111827",
        "text-dim":      "#4B5563",
        family:          "#DC2626",
        work:            "#2563EB",
        friend:          "#059669",
        business:        "#D97706",
        acquaintance:    "#7C3AED",
        community:       "#DB2777",
        other:           "#6B7280",
      },
      fontFamily: {
        sans:  ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        serif: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono:  ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        data:  ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: "4px",
        lg:      "6px",
        xl:      "8px",
        "2xl":   "12px",
      },
      boxShadow: {
        card:   "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.06)",
        panel:  "0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)",
        warm:   "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.06)",
        glow:   "0 0 0 2px rgba(37,99,235,0.25)",
        inset:  "inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        spin:      "spin 1s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(2px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
}

export default config
