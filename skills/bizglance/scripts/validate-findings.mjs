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

function buildKnownFiles(repoContext, codegraphContext) {
  const files = new Set();

  for (const item of repoContext.entityCandidates ?? []) {
    if (item.filePath) {
      files.add(item.filePath);
    }
  }

  for (const item of repoContext.entrypoints ?? []) {
    if (item.filePath) {
      files.add(item.filePath);
    }
  }

  for (const item of codegraphContext.nodes ?? []) {
    if (item.filePath) {
      files.add(item.filePath);
    }
  }

  for (const filePath of codegraphContext.relatedFiles ?? []) {
    files.add(filePath);
  }

  return files;
}

function buildKnownObjects(businessObjects) {
  return new Set(
    businessObjects
      .map((item) => item.technicalName)
      .filter((value) => typeof value === "string" && value.length > 0)
  );
}

function addWarning(review, code, target, message, severity = "warning") {
  review.warnings.push({ code, severity, target, message });
}

function addDowngrade(review, target, confidence, reason) {
  if (!review.downgrades.some((item) => item.target === target && item.confidence === confidence)) {
    review.downgrades.push({ target, confidence, reason });
  }
}

function reviewEvidence(review, target, finding, knownFiles) {
  if (!finding.evidence) {
    addWarning(review, "missing-evidence", target, `${target} 缺少 evidence，不能作为高置信度业务结论。`);
    if (finding.confidence === "high") {
      addDowngrade(review, target, "low", "缺少 evidence。");
    }
    return;
  }

  if (finding.evidence.filePath && !knownFiles.has(finding.evidence.filePath)) {
    addWarning(
      review,
      "unknown-evidence-path",
      `${target}.evidence.filePath`,
      `${target} 引用了未知 evidence 路径: ${finding.evidence.filePath}。`
    );
    if (finding.confidence === "high") {
      addDowngrade(review, target, "low", "evidence 路径不在已知代码事实中。");
    }
  }
}

export async function validateFindings(options) {
  const intermediateDir = resolve(options.intermediateDir);
  const output = resolve(options.output ?? resolve(intermediateDir, "review-warnings.json"));
  const repoContext = await readJsonIfExists(resolve(intermediateDir, "repo-context.json"), {});
  const codegraphContext = await readJsonIfExists(resolve(intermediateDir, "codegraph-context.json"), {});
  const businessObjects = asArray(
    await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.businessObjects), []),
    "businessObjects"
  );
  const flows = asArray(await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.flows), []), "flows");
  const statusMutations = asArray(
    await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.statusMutations), []),
    "statusMutations"
  );
  const fieldLineages = asArray(
    await readJsonIfExists(resolve(intermediateDir, FINDING_FILES.fieldLineages), []),
    "fieldLineages"
  );
  const knownFiles = buildKnownFiles(repoContext, codegraphContext);
  const knownObjects = buildKnownObjects(businessObjects);
  const review = { warnings: [], downgrades: [], removals: [], normalizations: [] };

  flows.forEach((finding, index) => {
    const target = `flows[${index}]`;
    reviewEvidence(review, target, finding, knownFiles);
    if (finding.from && !knownObjects.has(finding.from)) {
      addWarning(
        review,
        "dangling-object-reference",
        `${target}.from`,
        `${target}.from 引用了未知业务对象: ${finding.from}。`
      );
    }
    if (finding.to && !knownObjects.has(finding.to)) {
      addWarning(
        review,
        "dangling-object-reference",
        `${target}.to`,
        `${target}.to 引用了未知业务对象: ${finding.to}。`
      );
    }
  });

  statusMutations.forEach((finding, index) => {
    const target = `statusMutations[${index}]`;
    reviewEvidence(review, target, finding, knownFiles);
    if (finding.object && !knownObjects.has(finding.object)) {
      addWarning(
        review,
        "dangling-object-reference",
        `${target}.object`,
        `${target}.object 引用了未知业务对象: ${finding.object}。`
      );
    }
  });

  fieldLineages.forEach((finding, index) => {
    const target = `fieldLineages[${index}]`;
    reviewEvidence(review, target, finding, knownFiles);
    if (finding.object && !knownObjects.has(finding.object)) {
      addWarning(
        review,
        "dangling-object-reference",
        `${target}.object`,
        `${target}.object 引用了未知业务对象: ${finding.object}。`
      );
    }
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  return review;
}

async function main() {
  const [, , intermediateDir = ".bizglance/intermediate", output] = process.argv;
  await validateFindings({ intermediateDir, output });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
