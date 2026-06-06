import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

  it("derives business object identity from arbitrary domain class names", async () => {
    const root = await mkdtemp("E:/code/biz-glance/tmp-java-");
    const domainDir = join(root, "src/main/java/com/example/demo/domain");
    const serviceDir = join(root, "src/main/java/com/example/demo/service/impl");

    await mkdir(domainDir, { recursive: true });
    await mkdir(serviceDir, { recursive: true });

    try {
      await writeFile(
        join(domainDir, "SalesOrder.java"),
        [
          "package com.example.demo.domain;",
          "",
          "public class SalesOrder {",
          "    private String status;",
          "    public void setStatus(String status) {",
          "        this.status = status;",
          "    }",
          "}"
        ].join("\n"),
        "utf8"
      );

      await writeFile(
        join(serviceDir, "SalesOrderServiceImpl.java"),
        [
          "package com.example.demo.service.impl;",
          "",
          "import com.example.demo.domain.SalesOrder;",
          "",
          "public class SalesOrderServiceImpl {",
          "    public void changeStatus(String to) {",
          "        SalesOrder order = new SalesOrder();",
          "        order.setStatus(to);",
          "    }",
          "}"
        ].join("\n"),
        "utf8"
      );

      const doc = await analyzeJavaSpringProject(root);

      expect(doc.businessObjects.some((item) => item.technicalName === "SalesOrder")).toBe(true);
      expect(doc.statusMutations.some((item) => item.objectId === "sales-order")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
