#!/usr/bin/env node
import { VendorManager } from "./vendor";
import path from "node:path";
import fs from "node:fs";

async function main() {
  const pkgJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    console.error("No package.json found in current directory");
    process.exit(1);
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  const vendorConfig = pkgJson.vendorAssets || [];

  if (vendorConfig.length === 0) {
    console.warn("No 'vendorAssets' defined in package.json");
    return;
  }

  const manager = new VendorManager({
    packages: vendorConfig,
    targetDir: path.join(process.cwd(), "public", "assets", "vendor"),
  });

  await manager.vendor();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
