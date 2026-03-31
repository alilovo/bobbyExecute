import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@bot": resolve(__dirname, "src"),
      "@": resolve(__dirname, "../dashboard/src"),
      "server-only": resolve(__dirname, "../dashboard/src/test/server-only.ts"),
      "next/server": resolve(__dirname, "../dashboard/src/test/next-server-stub.ts"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
