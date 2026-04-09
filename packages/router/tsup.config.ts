import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/router.ts", "src/types.ts", "src/lib/routeDrawer.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  bundle: false,
  skipNodeModulesBundle: true,
  sourcemap: true,
});
