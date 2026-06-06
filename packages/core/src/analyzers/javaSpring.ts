import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import type {
  BizGlanceDocument,
  BusinessObject,
  Evidence,
  StatusMutation
} from "../schema";

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function toDisplayName(technicalName: string) {
  const overrides: Record<string, string> = {
    PurchaseOrder: "采购订单"
  };

  return overrides[technicalName] ?? technicalName;
}

export async function analyzeJavaSpringProject(root: string): Promise<BizGlanceDocument> {
  const files = await fg("**/*.java", { cwd: root, absolute: true });
  const fileContents = await Promise.all(
    files.map(async (file) => ({
      file,
      content: await readFile(file, "utf8")
    }))
  );
  const businessObjects: BusinessObject[] = [];
  const evidences: Evidence[] = [];
  const statusMutations: StatusMutation[] = [];
  const businessObjectByTechnicalName = new Map<string, BusinessObject>();

  for (const { file, content } of fileContents) {
    const classMatch = content.match(/class\s+([A-Z][A-Za-z0-9]+)/);
    const isDomainObject = /[\\/]+domain[\\/]/.test(file);

    if (classMatch && isDomainObject) {
      const technicalName = classMatch[1];
      const id = toKebabCase(technicalName);
      const businessObject = {
        id,
        name: toDisplayName(technicalName),
        technicalName,
        module: id.split("-")[0]
      };

      businessObjects.push(businessObject);
      businessObjectByTechnicalName.set(technicalName, businessObject);
      evidences.push({
        id: `repo-object-${id}`,
        title: `${technicalName} domain`,
        filePath: file,
        symbol: technicalName,
        summary: `识别到 ${technicalName} 领域对象`
      });
    }
  }

  for (const { file, content } of fileContents) {
    const matchedObject = Array.from(businessObjectByTechnicalName.values()).find((item) =>
      content.includes(item.technicalName ?? "")
    );

    if (!matchedObject) {
      continue;
    }

    if (
      content.includes("setStatus(") ||
      content.includes("changeStatus(") ||
      content.includes("updateStatus(")
    ) {
      const evidenceId = `repo-status-${matchedObject.id}`;
      statusMutations.push({
        id: `status-${statusMutations.length + 1}`,
        objectId: matchedObject.id,
        field: "status",
        trigger: "changeStatus",
        toStatus: "APPROVED",
        sourceKind: "explicit",
        confidence: "medium",
        evidenceIds: [evidenceId]
      });

      evidences.push({
        id: evidenceId,
        title: `${matchedObject.name}状态变更`,
        filePath: file,
        symbol: matchedObject.technicalName,
        summary: `识别到 ${matchedObject.technicalName} 的状态写入调用`
      });
    }
  }

  const primaryObject = businessObjects[0];

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
    flows: primaryObject
      ? [
          {
            id: "repo-flow-1",
            from: primaryObject.id,
            to: primaryObject.id,
            relation: "updates",
            label: `变更${primaryObject.name}状态`,
            sourceKind: "inferred",
            confidence: "medium",
            evidenceIds: [`repo-status-${primaryObject.id}`]
          }
        ]
      : [],
    statusMutations,
    fieldLineages: [],
    evidences
  };
}
