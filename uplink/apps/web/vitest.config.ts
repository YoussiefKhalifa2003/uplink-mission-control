import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@uplink/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
