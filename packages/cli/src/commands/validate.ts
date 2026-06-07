import {
  validateCodeGraphAssistedAnalysisInput,
  validateCompleteBizGlanceDocument,
  type ValidationResult
} from "../../../core/src/index";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type ValidateKind = "auto" | "document" | "context";
const validateKinds = new Set(["auto", "document", "context"]);

export interface ValidateCommandResult extends ValidationResult {
  kind: Exclude<ValidateKind, "auto">;
}

function resolveFromInitCwd(targetPath: string) {
  if (/^[A-Za-z]:\\|^\//.test(targetPath)) {
    return targetPath;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), targetPath);
}

function detectKind(input: unknown): Exclude<ValidateKind, "auto"> {
  if (
    typeof input === "object" &&
    input !== null &&
    "meta" in input &&
    "businessObjects" in input
  ) {
    return "document";
  }

  return "context";
}

function throwIfInvalid(validation: ValidateCommandResult) {
  if (validation.valid) {
    return;
  }

  throw new Error(`BizGlance 校验失败:\n${validation.errors.map((error) => `- ${error}`).join("\n")}`);
}

export async function runValidateCommand(options: {
  input: string;
  kind?: ValidateKind;
  readTextFile?: (filePath: string) => Promise<string>;
}): Promise<ValidateCommandResult> {
  const inputPath = resolveFromInitCwd(options.input);
  const readTextFile = options.readTextFile ?? ((filePath: string) => readFile(filePath, "utf8"));
  const parsed = JSON.parse(await readTextFile(inputPath)) as unknown;

  if (options.kind !== undefined && !validateKinds.has(String(options.kind))) {
    throw new Error("validate --kind 仅支持 auto、document 或 context。");
  }

  const kind = options.kind && options.kind !== "auto" ? options.kind : detectKind(parsed);
  const validation =
    kind === "document"
      ? validateCompleteBizGlanceDocument(parsed)
      : validateCodeGraphAssistedAnalysisInput(parsed);
  const result = {
    kind,
    ...validation
  };

  throwIfInvalid(result);

  return result;
}
