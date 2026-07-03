import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  // Served from the root of the custom domain (nexus.maydayprod.app), so assets live at "/".
  base: "/",
  build: {
    sourcemap: false,
    target: "es2020",
  },
})
