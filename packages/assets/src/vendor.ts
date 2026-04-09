import fs from "node:fs";
import path from "node:path";

export interface VendorOptions {
  packages: string[];
  targetDir: string;
}

export class VendorManager {
  constructor(private options: VendorOptions) {}

  async vendor() {
    if (!fs.existsSync(this.options.targetDir)) {
      fs.mkdirSync(this.options.targetDir, { recursive: true });
    }

    const importMap: Record<string, string> = {};

    for (const pkgName of this.options.packages) {
      const pkgPath = this.resolvePackagePath(pkgName);
      const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgPath, "package.json"), "utf-8"));

      // Determine the main entry point (preferring ESM)
      let entry = pkgJson.module || pkgJson.main;

      // Handle conditional exports if necessary (simplistic for now)
      if (pkgJson.exports && pkgJson.exports["."]) {
        const exports = pkgJson.exports["."];
        entry = exports.import || exports.default || entry;
        if (typeof entry === "object") {
          entry = entry.default;
        }
      }

      if (!entry) {
        console.warn(`Could not find entry point for ${pkgName}`);
        continue;
      }

      const sourceFile = path.join(pkgPath, entry);
      const pkgDir = path.join(this.options.targetDir, pkgName);
      const targetFile = path.join(pkgDir, "index.js");

      // Ensure target subdir exists
      if (!fs.existsSync(pkgDir)) {
        fs.mkdirSync(pkgDir, { recursive: true });
      }

      fs.copyFileSync(sourceFile, targetFile);

      // Also copy source map if it exists
      const sourceMap = `${sourceFile}.map`;
      if (fs.existsSync(sourceMap)) {
        const targetMap = `${targetFile}.map`;
        fs.copyFileSync(sourceMap, targetMap);

        // Post-process the JS file to update the source map directive
        let content = fs.readFileSync(targetFile, "utf-8");
        content = content.replace(
          /\/\/# sourceMappingURL=.*/g,
          `//# sourceMappingURL=index.js.map`,
        );
        fs.writeFileSync(targetFile, content);

        console.log(`Vendored source map ${sourceMap} -> ${targetMap} (and updated directive)`);
      }

      // Generate import map entry
      const publicPath = `/assets/vendor/${pkgName}/index.js`;
      importMap[pkgName] = publicPath;

      console.log(`Vendored ${pkgName} -> ${targetFile}`);

      // Copy src directory if it exists
      const srcDir = path.join(pkgPath, "src");
      if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
        this.copyDirRecursive(srcDir, pkgDir);
        console.log(`Vendored ${pkgName}/src -> ${pkgDir}`);
      }
    }

    // Write import map metadata for AssetPipeline to consume
    const metadataPath = path.join(this.options.targetDir, "importmap.json");
    const importMapData = { imports: importMap };
    fs.writeFileSync(metadataPath, JSON.stringify(importMapData, null, 2));

    // Also generate a TS/JS friendly version that can be imported
    const tsPath = path.join(this.options.targetDir, "importmap.ts");
    fs.writeFileSync(
      tsPath,
      `export const IMPORT_MAP = ${JSON.stringify(importMapData, null, 2)};\n`,
    );

    console.log(`Generated import maps at ${metadataPath} and ${tsPath}`);
  }

  private resolvePackagePath(pkgName: string): string {
    const cwd = process.cwd();

    // Check if there's a workspace symlink in node_modules that points to the source
    const nodeModulesPath = path.join(cwd, "node_modules", pkgName);
    if (fs.existsSync(nodeModulesPath)) {
      const stats = fs.lstatSync(nodeModulesPath);
      // If it's a symlink, resolve it to find the actual path
      if (stats.isSymbolicLink()) {
        const realPath = fs.realpathSync(nodeModulesPath);
        if (fs.existsSync(path.join(realPath, "dist"))) {
          return realPath;
        }
        // For source-only packages (no dist), return the real path
        return realPath;
      }
      // Check if dist exists in the package
      if (fs.existsSync(path.join(nodeModulesPath, "dist"))) {
        return nodeModulesPath;
      }
      // For source-only packages, return the path
      return nodeModulesPath;
    }

    // Check standard node_modules paths (parent directories)
    const standardPaths = [
      path.join(cwd, "..", "node_modules", pkgName),
      path.join(cwd, "..", "..", "node_modules", pkgName),
      path.join(cwd, "..", "..", "..", "node_modules", pkgName),
    ];

    for (const p of standardPaths) {
      if (fs.existsSync(p)) {
        // Also check for symlinks there
        const stats = fs.lstatSync(p);
        if (stats.isSymbolicLink()) {
          const realPath = fs.realpathSync(p);
          if (fs.existsSync(path.join(realPath, "dist"))) {
            return realPath;
          }
          // For source-only packages, return the real path
          return realPath;
        }
        if (fs.existsSync(path.join(p, "dist"))) {
          return p;
        }
        // For source-only packages, return the path
        return p;
      }
    }

    // Try pnpm monorepo structure - check for .pnpm directory
    const pnpmPath = path.join(cwd, "node_modules", ".pnpm");
    if (fs.existsSync(pnpmPath)) {
      const entries = fs.readdirSync(pnpmPath);
      // Look for entries that contain the package name
      const searchName = pkgName.replace("@", "").replace("/", "-");
      for (const entry of entries) {
        if (entry.includes(searchName)) {
          const pkgPath = path.join(pnpmPath, entry, "node_modules", pkgName);
          if (fs.existsSync(pkgPath)) {
            // Check for dist first, otherwise use source
            if (fs.existsSync(path.join(pkgPath, "dist"))) {
              return pkgPath;
            }
            return pkgPath;
          }
        }
      }
    }

    throw new Error(
      `Package ${pkgName} not found. Searched: ${nodeModulesPath}, ${standardPaths.join(", ")}`,
    );
  }

  private copyDirRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else if (entry.name.endsWith(".js") && entry.name !== "index.js") {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
