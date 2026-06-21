import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bizglance agent skill", () => {
  it("documents the workflow with agent orchestration", async () => {
    const content = await readFile(resolve("E:/code/biz-glance/skills/bizglance/SKILL.md"), "utf8");

    expect(content).toContain("/bizglance");
    expect(content).toContain("Phase 0");
    expect(content).toContain("Phase 1");
    expect(content).toContain("Phase 2");
    expect(content).toContain("Phase 3");
    expect(content).toContain("Phase 4");
    expect(content).toContain("Phase 5");

    expect(content).toContain("collect-repo-context.mjs");
    expect(content).toContain("merge-business-findings.mjs");
    expect(content).toContain("validate-findings.mjs");

    expect(content).toContain("business-object-agent");
    expect(content).toContain("business-flow-agent");
    expect(content).toContain("status-mutation-agent");
    expect(content).toContain("field-lineage-agent");
    expect(content).toContain("evidence-reviewer");
    expect(content).toContain("business-graph-reviewer");

    expect(content).toContain("Agent");
    expect(content).toContain("dev analyze");
    expect(content).toContain("dev validate");
    expect(content).toContain("dev serve");
    expect(content).toContain("codegraph-assisted-input.json");
    expect(content).toContain("review-warnings.json");
  });

  it("includes all agent definition files", async () => {
    const agents = [
      "business-object-agent.md",
      "business-flow-agent.md",
      "status-mutation-agent.md",
      "field-lineage-agent.md",
      "evidence-reviewer.md",
      "business-graph-reviewer.md"
    ];

    for (const agent of agents) {
      const path = resolve("E:/code/biz-glance/skills/bizglance/agents", agent);
      const content = await readFile(path, "utf8");
      expect(content.length).toBeGreaterThan(50);
      expect(content).toContain("Role");
      expect(content).toContain("输出");
    }
  });
});
