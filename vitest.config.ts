import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "apps/web/**"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    environment: "node",
  },
});
