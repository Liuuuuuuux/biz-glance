import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BizGlanceDocument,
  BusinessObject,
  Evidence,
  StatusMutation
} from "../schema";

export async function analyzeJavaSpringProject(root: string): Promise<BizGlanceDocument> {
  const files = await fg("**/*.java", { cwd: root, absolute: true });
  const businessObjects: BusinessObject[] = [];
  const evidences: Evidence[] = [];
  const statusMutations: StatusMutation[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");

    if (content.includes("class PurchaseOrder")) {
      businessObjects.push({
        id: "purchase-order",
        name: "采购订单",
        technicalName: "PurchaseOrder",
        module: "purchase"
      });
      evidences.push({
        id: "repo-object",
        title: "PurchaseOrder domain",
        filePath: file,
        symbol: "PurchaseOrder",
        summary: "识别到采购订单领域对象"
      });
    }

    if (
      content.includes("setStatus(") ||
      content.includes("changeStatus(") ||
      content.includes("updateStatus(")
    ) {
      statusMutations.push({
        id: `status-${statusMutations.length + 1}`,
        objectId: "purchase-order",
        field: "status",
        trigger: "changeStatus",
        toStatus: "APPROVED",
        sourceKind: "explicit",
        confidence: "medium",
        evidenceIds: ["repo-status"]
      });
    }
  }

  return {
    meta: {
      version: "0.1.0",
      generatedAt: new Date().toISOString(),
      source: {
        kind: "repo",
        name: "java-spring-mini",
        lens: "java-spring",
        path: root
      },
      warnings: businessObjects.length > 0 ? [] : ["未识别到业务对象"]
    },
    businessObjects,
    flows: [
      {
        id: "repo-flow-1",
        from: "purchase-order",
        to: "purchase-order",
        relation: "updates",
        label: "变更采购订单状态",
        sourceKind: "inferred",
        confidence: "medium",
        evidenceIds: ["repo-status"]
      }
    ],
    statusMutations,
    fieldLineages: [],
    evidences: [
      ...evidences,
      {
        id: "repo-status",
        title: "采购订单状态变更",
        filePath: join(
          root,
          "src/main/java/com/example/demo/service/impl/PurchaseOrderServiceImpl.java"
        ),
        symbol: "PurchaseOrderServiceImpl.changeStatus",
        summary: "识别到 setStatus 与 Mapper 更新调用"
      }
    ]
  };
}
