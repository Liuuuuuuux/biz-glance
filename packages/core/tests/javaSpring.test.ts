import { describe, expect, it } from "vitest";
import { analyzeJavaSpringProject } from "../src/analyzers/javaSpring";

describe("analyzeJavaSpringProject", () => {
  it("extracts a minimal status mutation and business object relation", async () => {
    const doc = await analyzeJavaSpringProject("E:/code/biz-glance/fixtures/java-spring-mini");

    expect(doc.meta.source.kind).toBe("repo");
    expect(doc.businessObjects.some((item) => item.name.includes("采购订单"))).toBe(true);
    expect(doc.flows.length).toBeGreaterThan(0);
    expect(doc.statusMutations.some((item) => item.field === "status")).toBe(true);
  });
});
