import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bizglance agent skill", () => {
  it("documents the MVP workflow contract", async () => {
    const content = await readFile(resolve("E:/code/biz-glance/skills/bizglance/SKILL.md"), "utf8");

    expect(content).toContain("/bizglance");
    expect(content).toContain("Phase 0");
    expect(content).toContain("CodeGraph");
    expect(content).toContain("collect-repo-context.mjs");
    expect(content).toContain("business-object-agent");
    expect(content).toContain("merge-business-findings.mjs");
    expect(content).toContain("validate-findings.mjs");
    expect(content).toContain("review-warnings.json");
    expect(content).toContain("llm-findings.json");
    expect(content).toContain("codegraph-assisted-input.json");
    expect(content).toContain("evidence-reviewer");
    expect(content).toContain("business-graph-reviewer");
    expect(content).toContain("bizglance analyze");
    expect(content).toContain("bizglance validate");
    expect(content).toContain("bizglance serve");
  });
});
