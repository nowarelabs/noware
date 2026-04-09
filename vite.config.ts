import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    rules: {
      "no-unused-vars": "warn",
      "no-explicit-any": "warn",
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  pack: {
    entry: "src/index.ts",
    format: ["esm", "cjs"],
    dts: true,
  },
});
