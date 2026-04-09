import { describe, it, expect, vi, beforeEach } from "vitest";
import { WranglerConfigUpdater } from "../config";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe("WranglerConfigUpdater", () => {
  const mockPath = "wrangler.jsonc";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse existing migrations", async () => {
    const content = `{
  "name": "test",
  "migrations": [
    {
      "tag": "v1"
    }
  ]
}`;
    vi.mocked(fs.readFile).mockResolvedValue(content);

    const updaterRes = await WranglerConfigUpdater.fromFile(mockPath);
    expect(updaterRes.success).toBe(true);

    updaterRes.match(
      (updater) => {
        const updateRes = updater.addMigrations(["v2"]);
        expect(updateRes.success).toBe(true);
      },
      (err) => {
        throw new Error(err.message);
      },
    );
  });

  it("should add new migrations while preserving existing ones", async () => {
    const content = `{
  "migrations": [
    {
      "tag": "v1"
    }
  ]
}`;
    vi.mocked(fs.readFile).mockResolvedValue(content);

    const updaterRes = await WranglerConfigUpdater.fromFile(mockPath);
    const updater = (updaterRes as any).data;

    updater.addMigrations(["v2"]);

    await updater.save();

    const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('"tag": "v1"');
    expect(writtenContent).toContain('"tag": "v2"');
    expect(writtenContent).toContain('"migrations": [');
  });

  it("should not add duplicate migrations", async () => {
    const content = `{
  "migrations": [
    {
      "tag": "v1"
    }
  ]
}`;
    vi.mocked(fs.readFile).mockResolvedValue(content);

    const updaterRes = await WranglerConfigUpdater.fromFile(mockPath);
    const updater = (updaterRes as any).data;

    const updateRes = updater.addMigrations(["v1"]);
    // It should return success but no changes in content (or at least no new entries)
    // In our implementation, it returns ok(this) if no new entries.
    expect(updateRes.success).toBe(true);

    // Check written content if we saved
    await updater.save();
    const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    // Count occurrences of "v1"
    const count = (writtenContent.match(/"v1"/g) || []).length;
    expect(count).toBe(1);
  });

  it("should handle empty migrations array", async () => {
    const content = `{
  "migrations": []
}`;
    vi.mocked(fs.readFile).mockResolvedValue(content);

    const updaterRes = await WranglerConfigUpdater.fromFile(mockPath);
    const updater = (updaterRes as any).data;

    updater.addMigrations(["v1"]);
    await updater.save();

    const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('"tag": "v1"');
  });

  it("should return error if migrations array is missing", async () => {
    const content = `{
  "name": "test"
}`;
    vi.mocked(fs.readFile).mockResolvedValue(content);

    const updaterRes = await WranglerConfigUpdater.fromFile(mockPath);
    const updater = (updaterRes as any).data;

    const updateRes = updater.addMigrations(["v1"]);
    expect(updateRes.success).toBe(false);
    expect((updateRes as any).error).toBe("Migrations array not found in configuration");
  });
});
