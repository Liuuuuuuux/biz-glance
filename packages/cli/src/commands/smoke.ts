import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BizGlanceDocument } from "../../../core/src/index";
import { runAnalyzeCommand } from "./analyze";

const DEFAULT_REPO = "fixtures/java-spring-mini";
const DEFAULT_OUT = "dist/smoke.bizglance.json";

type RunAnalyze = typeof runAnalyzeCommand;

export interface SmokeResult {
  outputPath: string;
  objectCount: number;
  flowCount: number;
  statusMutationCount: number;
  fieldLineageCount: number;
  evidenceCount: number;
}

function resolveFromWorkspace(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  const workspaceRoot = process.env.INIT_CWD ?? resolve(process.cwd(), "../..");
  return resolve(workspaceRoot, targetPath);
}

function failSmoke(message: string): never {
  throw new Error(`Smoke 验证失败: ${message}`);
}

function requireBusinessObject(document: BizGlanceDocument, technicalName: string) {
  if (!document.businessObjects.some((item) => item.technicalName === technicalName)) {
    failSmoke(`缺少业务对象 ${technicalName}`);
  }
}

function verifySmokeDocument(document: BizGlanceDocument) {
  requireBusinessObject(document, "PurchaseOrder");
  requireBusinessObject(document, "ReceiptOrder");

  if (
    !document.flows.some(
      (item) =>
        item.from === "purchase-order" &&
        item.to === "receipt-order" &&
        item.relation === "creates"
    )
  ) {
    failSmoke("缺少 PurchaseOrder 到 ReceiptOrder 的创建关系");
  }

  if (
    !document.statusMutations.some(
      (item) => item.objectId === "purchase-order" && item.field === "status"
    )
  ) {
    failSmoke("缺少 PurchaseOrder.status 状态变更");
  }

  if (
    !document.fieldLineages.some(
      (item) =>
        item.objectId === "receipt-order" &&
        item.targetField === "sourceStatus" &&
        item.sourceFields.includes("purchase-order.status")
    )
  ) {
    failSmoke("缺少 ReceiptOrder.sourceStatus 字段血缘");
  }

  if (document.evidences.length === 0) {
    failSmoke("缺少代码证据");
  }
}

export async function runSmokeCommand(options: {
  repo?: string;
  out?: string;
  runAnalyze?: RunAnalyze;
  readTextFile?: (filePath: string) => Promise<string>;
} = {}): Promise<SmokeResult> {
  const repo = resolveFromWorkspace(options.repo ?? DEFAULT_REPO);
  const outputPath = resolveFromWorkspace(options.out ?? DEFAULT_OUT);
  const runAnalyze = options.runAnalyze ?? runAnalyzeCommand;
  const readTextFile = options.readTextFile ?? ((filePath: string) => readFile(filePath, "utf8"));

  await runAnalyze({
    repo,
    out: outputPath,
    lens: "java-spring"
  });

  const document = JSON.parse(await readTextFile(outputPath)) as BizGlanceDocument;
  verifySmokeDocument(document);

  return {
    outputPath,
    objectCount: document.businessObjects.length,
    flowCount: document.flows.length,
    statusMutationCount: document.statusMutations.length,
    fieldLineageCount: document.fieldLineages.length,
    evidenceCount: document.evidences.length
  };
}
