import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/node.ts"],
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  fmt: {},
});
