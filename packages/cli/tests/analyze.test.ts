import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAnalyzeCommand } from "../src/commands/analyze";

const output = resolve("E:/code/biz-glance/tmp/sample-output.json");

afterEach(async () => {
  await rm(dirname(output), { recursive: true, force: true });
});

describe("cli analyze", () => {
  it("writes a sample document to disk", async () => {
    await runAnalyzeCommand({
      sample: "education",
      out: output
    });

    const text = await readFile(output, "utf8");
    expect(JSON.parse(text).meta.source.kind).toBe("sample");
  });

  it("fails when sample and repo are both provided", async () => {
    await expect(
      runAnalyzeCommand({
        sample: "education",
        repo: "E:/code/biz-glance/fixtures/java-spring-mini",
        out: "tmp/out.json"
      })
    ).rejects.toThrow("必须且只能提供 --sample 或 --repo 其中一个参数。");
  });

  it("resolves relative output paths from INIT_CWD", async () => {
    const previousInitCwd = process.env.INIT_CWD;
    const relativeOutput = "tmp/relative-output.json";
    const absoluteOutput = resolve("E:/code/biz-glance", relativeOutput);

    process.env.INIT_CWD = "E:/code/biz-glance";

    try {
      await runAnalyzeCommand({
        sample: "education",
        out: relativeOutput
      });

      const text = await readFile(absoluteOutput, "utf8");
      expect(JSON.parse(text).meta.source.kind).toBe("sample");
    } finally {
      process.env.INIT_CWD = previousInitCwd;
      await rm(dirname(absoluteOutput), { recursive: true, force: true });
    }
  });
});
