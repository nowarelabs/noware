import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export interface VendorOptions {
  packages: string[];
  targetDir: string;
}

export class VendorManager {
  private requireInstance: NodeRequire;

  constructor(private options: VendorOptions) {
    this.requireInstance = createRequire(path.join(process.cwd(), "package.json"));
  }

  async vendor() {
    if (!fs.existsSync(this.options.targetDir)) {
      fs.mkdirSync(this.options.targetDir, { recursive: true });
    }

    const importMap: Record<string, string> = {};

    for (const pkgName of this.options.packages) {
      try {
        const { pkgPath, pkgJson } = this.resolvePackage(pkgName);

        let entry = pkgJson.module || pkgJson.main;
        if (pkgJson.exports && pkgJson.exports["."]) {
          const exports = pkgJson.exports["."];
          const conditionalEntry = exports.import || exports.default || exports;
          entry =
            typeof conditionalEntry === "object" ? conditionalEntry.default : conditionalEntry;
        }

        if (!entry || typeof entry !== "string") {
          console.warn(`Could not find entry point for ${pkgName}`);
          continue;
        }

        // Standardize internal path configurations
        entry = path.normalize(entry).replace(/^(\.\.\/*|\.\/*)+/, "");

        const pkgDir = path.join(this.options.targetDir, pkgName);
        if (fs.existsSync(pkgDir)) {
          fs.rmSync(pkgDir, { recursive: true, force: true });
        }
        fs.mkdirSync(pkgDir, { recursive: true });

        // Copy everything to keep nested dependency chunks aligned
        this.copyDirRecursive(pkgPath, pkgDir);

        const targetFile = path.join(pkgDir, entry);
        const sourceMap = `${targetFile}.map`;

        if (fs.existsSync(sourceMap)) {
          let content = fs.readFileSync(targetFile, "utf-8");
          const mapName = path.basename(sourceMap);
          content = content.replace(
            /\/\/# sourceMappingURL=.*/g,
            `//# sourceMappingURL=${mapName}`,
          );
          fs.writeFileSync(targetFile, content);
        }

        // Direct web asset path mapping pointing to the structural file entry name
        const publicPath = `/assets/vendor/${pkgName}/${entry.replace(/\\/g, "/")}`;
        importMap[pkgName] = publicPath;

        console.log(`✓ Vendored ${pkgName} -> ${publicPath}`);
      } catch (err: any) {
        console.error(`✗ Failed packaging ${pkgName}: ${err.message}`);
      }
    }

    // Write metadata json layout for static bundlers
    const metadataPath = path.join(this.options.targetDir, "importmap.json");
    fs.writeFileSync(metadataPath, JSON.stringify({ imports: importMap }, null, 2));

    // Save configuration module next to index.ts so our pipeline consumes it instantly
    const tsPath = path.join(process.cwd(), "src", "importmap.ts");
    fs.writeFileSync(
      tsPath,
      `export const IMPORT_MAP = ${JSON.stringify({ imports: importMap }, null, 2)};\n`,
    );

    console.log(`Generated active runtime configurations at ${tsPath}`);
  }

  private resolvePackage(pkgName: string): { pkgPath: string; pkgJson: any } {
    try {
      const jsonPath = this.requireInstance.resolve(`${pkgName}/package.json`);
      return {
        pkgPath: path.dirname(jsonPath),
        pkgJson: JSON.parse(fs.readFileSync(jsonPath, "utf-8")),
      };
    } catch {
      const entryFile = this.requireInstance.resolve(pkgName);
      let currentDir = path.dirname(entryFile);
      while (currentDir !== path.parse(currentDir).root) {
        const jsonPath = path.join(currentDir, "package.json");
        if (fs.existsSync(jsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
          if (pkgJson.name === pkgName) return { pkgPath: currentDir, pkgJson };
        }
        currentDir = path.dirname(currentDir);
      }
      throw new Error(`Could not find package root for ${pkgName}`);
    }
  }

  private copyDirRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (["node_modules", ".git", "README.md"].includes(entry.name)) continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
