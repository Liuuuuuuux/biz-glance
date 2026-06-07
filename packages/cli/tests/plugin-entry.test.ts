import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin entry", () => {
  it("provides a valid codex plugin manifest pointing at the bizglance skill", async () => {
    const manifest = JSON.parse(
      await readFile(resolve("E:/code/biz-glance/.codex-plugin/plugin.json"), "utf8")
    ) as {
      name: string;
      version: string;
      skills?: string;
      interface?: { displayName?: string; defaultPrompt?: string[] };
    };

    expect(manifest.name).toBe("bizglance");
    expect(manifest.version).toMatch(/^0\.1\.0/);
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.interface?.displayName).toBe("BizGlance");
    expect(manifest.interface?.defaultPrompt?.[0]).toContain("/bizglance");
  });

  it("documents Claude Code usage in CLAUDE.md", async () => {
    const content = await readFile(resolve("E:/code/biz-glance/CLAUDE.md"), "utf8");

    expect(content).toContain("/bizglance");
    expect(content).toContain("bizglance workflow");
    expect(content).toContain("--full");
    expect(content).toContain("--review");
    expect(content).toContain("--language");
  });
});
