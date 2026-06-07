import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FINDING_FILES = {
  businessObjects: "business-object-findings.json",
  flows: "business-flow-findings.json",
  statusMutations: "status-mutation-findings.json",
  fieldLineages: "field-lineage-findings.json"
};

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

function asArray(value, key) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object" && Array.isArray(value[key])) {
    return value[key];
  }

  return [];
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export async function mergeBusinessFindings(options) {
  const intermediateDir = resolve(options.intermediateDir);
  const output = resolve(options.output ?? resolve(intermediateDir, "codegraph-assisted-input.json"));
  const codegraph = await readJsonIfExists(resolve(intermediateDir, "codegraph-context.json"), {});
  const businessObjectsInput = await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.businessObjects), []);
  const flowsInput = await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.flows), []);
  const statusMutationsInput = await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.statusMutations), []);
  const fieldLineagesInput = await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.fieldLineages), []);

  const findings = {
    businessObjects: uniqueBy(
      asArray(businessObjectsInput, "businessObjects"),
      (item) => item && item.technicalName ? String(item.technicalName) : JSON.stringify(item)
    ),
    flows: uniqueBy(
      asArray(flowsInput, "flows"),
      (item) => `${item?.from ?? ""}:${item?.to ?? ""}:${item?.relation ?? ""}:${item?.label ?? ""}`
    ),
    statusMutations: uniqueBy(
      asArray(statusMutationsInput, "statusMutations"),
      (item) => `${item?.object ?? ""}:${item?.field ?? ""}:${item?.trigger ?? ""}:${item?.toStatus ?? ""}`
    ),
    fieldLineages: uniqueBy(
      asArray(fieldLineagesInput, "fieldLineages"),
      (item) => `${item?.object ?? ""}:${item?.targetField ?? ""}:${(item?.sourceFields ?? []).join(",")}`
    )
  };

  const merged = {
    codegraph,
    findings
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  return merged;
}

async function main() {
  const [, , intermediateDir = ".bizglance/intermediate", output] = process.argv;
  await mergeBusinessFindings({
    intermediateDir,
    output
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
