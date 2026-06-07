import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runInitCommand } from "../src/commands/init";

const tmpRoot = resolve("E:/code/biz-glance/tmp/cli-init-tests");

async function clean(path: string) {
  await rm(path, { recursive: true, force: true });
}

describe("cli init", () => {
  it("creates the BizGlance workspace directories and default files", async () => {
    const repo = resolve(tmpRoot, "fresh-repo");
    await clean(repo);
    await mkdir(repo, { recursive: true });

    const result = await runInitCommand({ repo });

    const config = JSON.parse(await readFile(resolve(repo, ".bizglance/config.json"), "utf8"));
    const gitignore = await readFile(resolve(repo, ".bizglance/.gitignore"), "utf8");

    expect(result.workspaceDir).toBe(resolve(repo, ".bizglance"));
    expect(result.createdConfig).toBe(true);
    expect(config).toEqual({
      language: "zh",
      autoServe: true,
      defaultLens: "codegraph-assisted"
    });
    expect(gitignore).toContain("bizglance.json");
    expect(gitignore).toContain("intermediate/");
    expect(gitignore).toContain("tmp/");
    await expect(readFile(resolve(repo, ".bizglance/intermediate/.gitkeep"), "utf8")).resolves.toBe("");
    await expect(readFile(resolve(repo, ".bizglance/tmp/.gitkeep"), "utf8")).resolves.toBe("");
  });

  it("preserves an existing config file", async () => {
    const repo = resolve(tmpRoot, "existing-config-repo");
    const configPath = resolve(repo, ".bizglance/config.json");
    await clean(repo);
    await mkdir(resolve(repo, ".bizglance"), { recursive: true });
    await writeFile(configPath, JSON.stringify({ language: "en", autoServe: false }), "utf8");

    const result = await runInitCommand({ repo });

    expect(result.createdConfig).toBe(false);
    expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
      language: "en",
      autoServe: false
    });
  });

  it("fails when the target repository directory does not exist", async () => {
    const repo = resolve(tmpRoot, "missing-repo");
    await clean(repo);

    await expect(runInitCommand({ repo })).rejects.toThrow("目标目录不存在");
  });
});
