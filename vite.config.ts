import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/ago_socihalo/",
  build: {
    sourcemap: false,
    target: "es2020",
  },
})
