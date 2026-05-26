import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  resolve: {
    alias: {
      "@uplink/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@uplink/propagation": path.resolve(__dirname, "../../packages/propagation/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          globe: ["react-globe.gl", "three"],
        },
      },
    },
  },
});
