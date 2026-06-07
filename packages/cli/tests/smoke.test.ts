import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { BizGlanceDocument } from "../../core/src/index";
import { runSmokeCommand } from "../src/commands/smoke";

function createSmokeDocument(): BizGlanceDocument {
  return {
    meta: {
      version: "0.1.0",
      generatedAt: "2026-06-06T00:00:00.000Z",
      source: {
        kind: "repo",
        name: "biz-glance",
        lens: "codegraph-assisted",
        path: "E:/code/biz-glance"
      },
      warnings: []
    },
    businessObjects: [
      {
        id: "product",
        name: "商品",
        technicalName: "Product"
      },
      {
        id: "category",
        name: "商品分类",
        technicalName: "Category"
      }
    ],
    flows: [
      {
        id: "codegraph-flow-1",
        from: "product",
        to: "category",
        relation: "references",
        label: "商品归属分类",
        sourceKind: "inferred",
        confidence: "medium",
        evidenceIds: ["codegraph-flow-1"]
      }
    ],
    statusMutations: [
      {
        id: "codegraph-status-1",
        objectId: "product",
        field: "stock",
        trigger: "ProductController.addProduct",
        toStatus: "created",
        sourceKind: "inferred",
        confidence: "medium",
        evidenceIds: ["codegraph-status-1"]
      }
    ],
    fieldLineages: [
      {
        id: "codegraph-lineage-1",
        objectId: "category",
        targetField: "products",
        sourceFields: ["product.category"],
        expression: "Product.category",
        sourceKind: "inferred",
        confidence: "medium",
        evidenceIds: ["codegraph-lineage-1"]
      }
    ],
    evidences: [
      {
        id: "codegraph-object-product",
        title: "商品 业务对象",
        filePath: "src/main/java/com/example/shop/domain/Product.java",
        symbol: "Product",
        lines: { start: 8, end: 42 },
        summary: "LLM 基于 CodeGraph class 节点识别商品领域对象"
      },
      {
        id: "codegraph-flow-1",
        title: "商品归属分类",
        filePath: "src/main/java/com/example/shop/domain/Product.java",
        symbol: "Product",
        lines: { start: 8, end: 42 },
        summary: "LLM 基于 CodeGraph class 节点识别商品分类关系"
      }
    ]
  };
}

describe("cli smoke", () => {
  it("analyzes the default CodeGraph context and verifies the reproducible demo contract", async () => {
    const analyzeCalls: Array<{ repo?: string; out?: string; codegraphContext?: string; lens?: string }> = [];

    const result = await runSmokeCommand({
      runAnalyze: async (options) => {
        analyzeCalls.push({
          repo: options.repo,
          out: options.out,
          codegraphContext: options.codegraphContext,
          lens: options.lens
        });
      },
      readTextFile: async () => JSON.stringify(createSmokeDocument())
    });

    expect(analyzeCalls).toEqual([
      {
        repo: resolve("E:/code/biz-glance"),
        out: resolve("E:/code/biz-glance/dist/smoke.bizglance.json"),
        codegraphContext: resolve("E:/code/biz-glance/fixtures/codegraph/shop-context.json"),
        lens: "codegraph-assisted"
      }
    ]);
    expect(result).toEqual({
      outputPath: resolve("E:/code/biz-glance/dist/smoke.bizglance.json"),
      objectCount: 2,
      flowCount: 1,
      statusMutationCount: 1,
      fieldLineageCount: 1,
      evidenceCount: 2
    });
  });

  it("fails with a focused message when the smoke output misses a required business object", async () => {
    const document = createSmokeDocument();
    document.businessObjects = document.businessObjects.filter(
      (item) => item.technicalName !== "Category"
    );

    await expect(
      runSmokeCommand({
        runAnalyze: async () => {},
        readTextFile: async () => JSON.stringify(document)
      })
    ).rejects.toThrow("Smoke 验证失败: 缺少业务对象 Category");
  });
});
