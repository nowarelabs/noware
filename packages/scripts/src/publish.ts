import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";

interface PublishOptions {
  packages?: string[];
  version?: string;
  dryRun?: boolean;
  access?: "public" | "restricted";
}

const NPM_TOKEN = process.env.NPM_TOKEN;
const DEFAULT_ACCESS = "public";

async function getPackages(): Promise<string[]> {
  const packagesDir = resolve(process.cwd(), "packages");
  const packages = readdirSync(packagesDir).filter((name) => {
    const pkgPath = join(packagesDir, name);
    return existsSync(join(pkgPath, "package.json"));
  });
  return packages;
}

function updatePackageVersion(pkgDir: string, version: string): void {
  const pkgPath = join(pkgDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function buildPackage(pkg: string): void {
  console.log(`Building ${pkg}...`);
  try {
    execSync(`pnpm --filter "nomo/${pkg}" build`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error(`Failed to build ${pkg}`);
    throw error;
  }
}

function publishPackage(pkg: string, options: PublishOptions): void {
  const pkgDir = resolve(process.cwd(), "packages", pkg);

  if (options.version) {
    updatePackageVersion(pkgDir, options.version);
  }

  const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8")).version;

  const access = options.access || DEFAULT_ACCESS;
  const publishArgs = ["publish", "--access", access];

  if (options.dryRun) {
    publishArgs.push("--dry-run");
  }

  console.log(`Publishing nomo/${pkg}@${version} (${options.dryRun ? "dry-run" : "live"})...`);

  try {
    execSync(`npm ${publishArgs.join(" ")}`, {
      stdio: "inherit",
      cwd: pkgDir,
      env: { ...process.env, NPM_TOKEN },
    });
  } catch (error) {
    console.error(`Failed to publish nomo/${pkg}`);
    throw error;
  }
}

export async function publish(options: PublishOptions = {}): Promise<void> {
  if (!NPM_TOKEN) {
    console.log("NPM_TOKEN not set. Running in dry-run mode.");
    options.dryRun = true;
  }

  const packages = options.packages || (await getPackages());

  console.log(`Publishing packages: ${packages.join(", ")}`);
  console.log(`Version: ${options.version || "from package.json"}`);
  console.log(`Dry run: ${options.dryRun || false}`);
  console.log("");

  for (const pkg of packages) {
    try {
      buildPackage(pkg);
      publishPackage(pkg, options);
      console.log(`Successfully published nomo/${pkg}\n`);
    } catch (error) {
      console.error(`Error publishing nomo/${pkg}:`, error);
      process.exit(1);
    }
  }

  console.log("All packages published successfully!");
}

export function parseArgs(args: string[]): PublishOptions {
  const options: PublishOptions = {
    packages: [],
    dryRun: false,
    access: "public",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--packages":
      case "-p":
        options.packages = args[++i].split(",");
        break;
      case "--version":
      case "-v":
        options.version = args[++i];
        break;
      case "--dry-run":
      case "-d":
        options.dryRun = true;
        break;
      case "--access":
        options.access = args[++i] as "public" | "restricted";
        break;
    }
  }

  return options;
}

const isRun =
  typeof process !== "undefined" && process.argv && process.argv[1]?.includes("publish");

if (isRun) {
  const options = parseArgs(process.argv.slice(2));
  publish(options).catch(console.error);
}
