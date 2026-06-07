import { access, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runAnalyzeCommand } from "../src/commands/analyze";
import { runInitCommand } from "../src/commands/init";
import { runValidateCommand } from "../src/commands/validate";
import { runWorkflowCommand } from "../src/commands/workflow";

const tmpRoot = resolve("E:/code/biz-glance/tmp/cli-workflow-tests");

async function resetDir(path: string) {
  await rm(path, { recursive: true, force: true });
  await mkdir(path, { recursive: true });
}

describe("cli workflow", () => {
  it("runs init, analyze, and validate against a .bizglance workspace", async () => {
    const repo = resolve(tmpRoot, "shop-workflow");
    const outputPath = resolve(repo, ".bizglance/bizglance.json");
    const metaPath = resolve(repo, ".bizglance/meta.json");

    await resetDir(repo);

    const initResult = await runInitCommand({ repo });

    expect(initResult.workspaceDir).toBe(resolve(repo, ".bizglance"));
    await expect(access(resolve(repo, ".bizglance/intermediate/.gitkeep"))).resolves.toBeUndefined();
    await expect(access(resolve(repo, ".bizglance/tmp/.gitkeep"))).resolves.toBeUndefined();

    await runAnalyzeCommand({
      repo,
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      out: outputPath
    });

    const validateResult = await runValidateCommand({
      input: outputPath,
      kind: "document"
    });

    expect(validateResult.valid).toBe(true);

    const document = JSON.parse(await readFile(outputPath, "utf8")) as {
      businessObjects: Array<{ technicalName?: string }>;
      meta: { source: { path?: string; lens: string } };
    };
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as {
      outputPath: string;
      contextPath: string;
      source: { path: string };
    };

    expect(document.meta.source.lens).toBe("codegraph-assisted");
    expect(document.meta.source.path).toBe(repo);
    expect(document.businessObjects.map((item) => item.technicalName)).toEqual(
      expect.arrayContaining(["Product", "Category"])
    );
    expect(meta.outputPath).toBe(outputPath.replace(/\\/g, "/"));
    expect(meta.contextPath).toBe("E:/code/biz-glance/fixtures/codegraph/shop-context.json");
    expect(meta.source.path).toBe(repo.replace(/\\/g, "/"));
  });

  it("runs the real workflow command end-to-end with noServe", async () => {
    const repo = resolve(tmpRoot, "workflow-command");

    await resetDir(repo);

    const result = await runWorkflowCommand({
      repo,
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      noServe: true
    });

    expect(result.previewUrl).toBeUndefined();
    expect(result.outputPath.replace(/\\/g, "/")).toBe(
      `${repo.replace(/\\/g, "/")}/.bizglance/bizglance.json`
    );

    const document = JSON.parse(await readFile(result.outputPath, "utf8")) as {
      businessObjects: Array<{ technicalName?: string }>;
    };

    expect(document.businessObjects.map((item) => item.technicalName)).toEqual(
      expect.arrayContaining(["Product", "Category"])
    );
  });
});
