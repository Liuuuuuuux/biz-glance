import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BizGlanceDocument } from "../../../core/src/index";
import { runAnalyzeCommand } from "./analyze";

const DEFAULT_REPO = ".";
const DEFAULT_CODEGRAPH_CONTEXT = "fixtures/codegraph/shop-context.json";
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
  if (document.meta.source.lens !== "codegraph-assisted") {
    failSmoke("输出不是 codegraph-assisted lens");
  }

  requireBusinessObject(document, "Product");
  requireBusinessObject(document, "Category");

  if (
    !document.flows.some(
      (item) =>
        item.from === "product" &&
        item.to === "category" &&
        item.relation === "references"
    )
  ) {
    failSmoke("缺少 Product 到 Category 的引用关系");
  }

  if (
    !document.statusMutations.some(
      (item) => item.objectId === "product" && item.field === "stock"
    )
  ) {
    failSmoke("缺少 Product.stock 状态变更");
  }

  if (
    !document.fieldLineages.some(
      (item) =>
        item.objectId === "category" &&
        item.targetField === "products" &&
        item.sourceFields.includes("product.category")
    )
  ) {
    failSmoke("缺少 Category.products 字段血缘");
  }

  if (document.evidences.length === 0) {
    failSmoke("缺少代码证据");
  }
}

export async function runSmokeCommand(options: {
  repo?: string;
  codegraphContext?: string;
  out?: string;
  runAnalyze?: RunAnalyze;
  readTextFile?: (filePath: string) => Promise<string>;
} = {}): Promise<SmokeResult> {
  const repo = resolveFromWorkspace(options.repo ?? DEFAULT_REPO);
  const codegraphContext = resolveFromWorkspace(options.codegraphContext ?? DEFAULT_CODEGRAPH_CONTEXT);
  const outputPath = resolveFromWorkspace(options.out ?? DEFAULT_OUT);
  const runAnalyze = options.runAnalyze ?? runAnalyzeCommand;
  const readTextFile = options.readTextFile ?? ((filePath: string) => readFile(filePath, "utf8"));

  await runAnalyze({
    repo,
    codegraphContext,
    out: outputPath,
    lens: "codegraph-assisted"
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
