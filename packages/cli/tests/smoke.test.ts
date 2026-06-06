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
        name: "java-spring-mini",
        lens: "java-spring",
        path: "E:/code/biz-glance/fixtures/java-spring-mini"
      },
      warnings: []
    },
    businessObjects: [
      {
        id: "purchase-order",
        name: "采购订单",
        technicalName: "PurchaseOrder"
      },
      {
        id: "receipt-order",
        name: "ReceiptOrder",
        technicalName: "ReceiptOrder"
      }
    ],
    flows: [
      {
        id: "repo-flow-creates-purchase-order-receipt-order",
        from: "purchase-order",
        to: "receipt-order",
        relation: "creates",
        label: "采购订单生成ReceiptOrder",
        sourceKind: "inferred",
        confidence: "medium",
        evidenceIds: ["repo-flow-creates-purchase-order-receipt-order"]
      }
    ],
    statusMutations: [
      {
        id: "status-1",
        objectId: "purchase-order",
        field: "status",
        trigger: "setStatus",
        toStatus: "APPROVED",
        sourceKind: "explicit",
        confidence: "medium",
        evidenceIds: ["repo-status-purchase-order"]
      }
    ],
    fieldLineages: [
      {
        id: "repo-lineage-receipt-order-source-status",
        objectId: "receipt-order",
        targetField: "sourceStatus",
        sourceFields: ["purchase-order.status"],
        expression: "order.getStatus()",
        sourceKind: "inferred",
        confidence: "medium",
        evidenceIds: ["repo-lineage-receipt-order-source-status"]
      }
    ],
    evidences: [
      {
        id: "repo-object-purchase-order",
        title: "PurchaseOrder domain",
        filePath: "E:/code/biz-glance/fixtures/java-spring-mini/src/main/java/com/example/PurchaseOrder.java",
        symbol: "PurchaseOrder",
        summary: "识别到 PurchaseOrder 领域对象"
      },
      {
        id: "repo-lineage-receipt-order-source-status",
        title: "ReceiptOrder.sourceStatus",
        filePath: "E:/code/biz-glance/fixtures/java-spring-mini/src/main/java/com/example/PurchaseOrderService.java",
        symbol: "setSourceStatus",
        summary: "识别到 ReceiptOrder.sourceStatus 来源于 PurchaseOrder.status"
      }
    ]
  };
}

describe("cli smoke", () => {
  it("analyzes the default Java/Spring fixture and verifies the reproducible demo contract", async () => {
    const analyzeCalls: Array<{ repo?: string; out: string }> = [];

    const result = await runSmokeCommand({
      runAnalyze: async (options) => {
        analyzeCalls.push({
          repo: options.repo,
          out: options.out
        });
      },
      readTextFile: async () => JSON.stringify(createSmokeDocument())
    });

    expect(analyzeCalls).toEqual([
      {
        repo: resolve("E:/code/biz-glance/fixtures/java-spring-mini"),
        out: resolve("E:/code/biz-glance/dist/smoke.bizglance.json")
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
      (item) => item.technicalName !== "ReceiptOrder"
    );

    await expect(
      runSmokeCommand({
        runAnalyze: async () => {},
        readTextFile: async () => JSON.stringify(document)
      })
    ).rejects.toThrow("Smoke 验证失败: 缺少业务对象 ReceiptOrder");
  });
});
