import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app:         "#0E0C08",
        surface:     "#19160F",
        "surface-2": "#231F15",
        "surface-3": "#2E291C",
        border:      "#3A3425",
        muted:       "#9A8970",
        accent:      "#E09A4A",
        "accent-2":  "#B87530",
        text:        "#EEE6CF",
        "text-dim":  "#C4B898",
        family:      "#C85454",
        work:        "#5085B5",
        friend:      "#4FA870",
        business:    "#C4A030",
        acquaintance:"#7E6AB0",
        community:   "#C06090",
        other:       "#7A7568",
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        mono:  ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "5px",
        lg:      "9px",
        xl:      "13px",
        "2xl":   "18px",
      },
      boxShadow: {
        card:   "0 1px 4px rgba(0,0,0,0.5), 0 0 0 1px rgba(58,52,37,0.6)",
        panel:  "0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(58,52,37,0.4)",
        warm:   "0 0 20px rgba(224,154,74,0.15)",
        glow:   "0 0 12px rgba(224,154,74,0.3)",
        inset:  "inset 0 1px 0 rgba(238,230,207,0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.18s ease-out",
        spin:      "spin 1s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(3px)" },
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
