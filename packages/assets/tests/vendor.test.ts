import { describe, expect, test, vi, beforeEach, afterEach } from "vite-plus/test";
import { VendorManager } from "../src/vendor.ts";
import * as fs from "fs";
import * as path from "path";

describe("VendorManager", () => {
  let mockRequireInstance: any;
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = path.join((global as any).process?.cwd() || "/tmp", "temp-test-dir");
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Mock the require instance
    mockRequireInstance = {
      resolve: vi.fn(),
    };
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  test("constructor initializes with options", () => {
    const options = {
      packages: ["test-package"],
      targetDir: path.join(tempDir, "vendor"),
    };

    const manager = new VendorManager(options);
    expect(manager).toBeDefined();
    // @ts-ignore - accessing private property for testing
    expect(manager.options).toEqual(options);
  });

  test("resolvePackage finds package by package.json", () => {
    // Setup mock package structure
    const pkgDir = path.join(tempDir, "test-package");
    fs.mkdirSync(pkgDir, { recursive: true });
    const pkgJsonPath = path.join(pkgDir, "package.json");
    fs.writeFileSync(pkgJsonPath, JSON.stringify({ name: "test-package", version: "1.0.0" }));

    // Mock requireInstance.resolve to return our package.json path
    mockRequireInstance.resolve.mockReturnValue(pkgJsonPath);

    const manager = new VendorManager({
      packages: ["test-package"],
      targetDir: path.join(tempDir, "vendor"),
    });
    // @ts-ignore - accessing private property for testing
    manager.requireInstance = mockRequireInstance;

    const result = manager["resolvePackage"]("test-package");
    expect(result).toBeDefined();
    expect(result.pkgPath).toBe(pkgDir);
    expect(result.pkgJson).toEqual({ name: "test-package", version: "1.0.0" });
  });

  test("resolvePackage finds package by walking up directory tree", () => {
    // Setup mock package structure without package.json in the entry file directory
    const pkgDir = path.join(tempDir, "test-package");
    const srcDir = path.join(pkgDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    const entryFile = path.join(srcDir, "index.js");
    fs.writeFileSync(entryFile, "");

    // Place package.json in parent directory
    const pkgJsonPath = path.join(pkgDir, "package.json");
    fs.writeFileSync(pkgJsonPath, JSON.stringify({ name: "test-package", version: "1.0.0" }));

    // Mock requireInstance.resolve to return our entry file path
    mockRequireInstance.resolve.mockReturnValue(entryFile);

    const manager = new VendorManager({
      packages: ["test-package"],
      targetDir: path.join(tempDir, "vendor"),
    });
    // @ts-ignore - accessing private property for testing
    manager.requireInstance = mockRequireInstance;

    const result = manager["resolvePackage"]("test-package");
    expect(result).toBeDefined();
    expect(result.pkgPath).toBe(pkgDir);
    expect(result.pkgJson).toEqual({ name: "test-package", version: "1.0.0" });
  });

  test("copyDirRecursive copies files and directories", () => {
    const srcDir = path.join(tempDir, "source");
    const destDir = path.join(tempDir, "destination");

    // Create source directory structure
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(path.join(srcDir, "subdir"), { recursive: true });
    fs.mkdirSync(path.join(srcDir, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(srcDir, ".git"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "file1.txt"), "content1");
    fs.writeFileSync(path.join(srcDir, "subdir", "file2.txt"), "content2");
    fs.writeFileSync(path.join(srcDir, "node_modules", "should-be-skipped.txt"), "skip");
    fs.writeFileSync(path.join(srcDir, ".git", "should-be-skipped.txt"), "skip");
    fs.writeFileSync(path.join(srcDir, "README.md"), "should be skipped");

    const manager = new VendorManager({
      packages: [],
      targetDir: destDir,
    });
    // @ts-ignore - accessing private method for testing
    manager["copyDirRecursive"](srcDir, destDir);

    // Verify files were copied correctly
    expect(fs.existsSync(path.join(destDir, "file1.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, "file1.txt"), "utf-8")).toBe("content1");

    expect(fs.existsSync(path.join(destDir, "subdir", "file2.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, "subdir", "file2.txt"), "utf-8")).toBe("content2");

    // Verify skipped files were not copied
    expect(fs.existsSync(path.join(destDir, "node_modules"))).toBe(false);
    expect(fs.existsSync(path.join(destDir, ".git"))).toBe(false);
    expect(fs.existsSync(path.join(destDir, "README.md"))).toBe(false);
  });
});
