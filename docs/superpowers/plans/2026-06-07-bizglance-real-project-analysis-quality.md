# BizGlance Real Project Analysis Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move BizGlance from a runnable workflow MVP to a more reliable real-project analysis workflow by adding deterministic findings validation, reviewer warning integration, and realistic project acceptance tests.

**Architecture:** Keep LLM business interpretation in the `skills/bizglance/agents/` prompts, but make quality gates deterministic and testable in scripts and CLI workflow code. The CLI should not call LLMs directly; it should prepare facts, preserve agent outputs, validate findings against known evidence, merge findings, inject review warnings into `BizGlanceDocument.meta.warnings`, and then run existing `analyze` and `validate` commands.

**Tech Stack:** TypeScript, pnpm workspaces, Commander, Vitest, Node `fs/promises`, repo-local `.mjs` skill scripts.

---

## Current Baseline

The current `master` already has:

- `bizglance workflow <repo> --no-serve` without explicit `--context`.
- `.bizglance/intermediate/repo-context.json` generation through `skills/bizglance/scripts/collect-repo-context.mjs`.
- `.bizglance/intermediate/codegraph-context.json` fallback from deterministic candidates.
- `.bizglance/intermediate/codegraph-assisted-input.json` generation through `skills/bizglance/scripts/merge-business-findings.mjs`.
- Business agent prompt files under `skills/bizglance/agents/`.
- Basic runtime validation for CodeGraph-assisted input and final BizGlance documents.

Known gaps:

- Agent findings files are merged but not deterministically reviewed.
- Evidence paths and line ranges are not checked against `repo-context.json` or `codegraph-context.json`.
- High-confidence findings without evidence are not downgraded or warned.
- Review warnings are not written to `.bizglance/intermediate/review-warnings.json`.
- Workflow does not inject reviewer warnings into `BizGlanceDocument.meta.warnings`.
- Acceptance tests use small generated temp repos, not a realistic multi-file business fixture.

## File Structure

- Create `skills/bizglance/scripts/validate-findings.mjs`: deterministic reviewer for business findings. It reads `.bizglance/intermediate/repo-context.json`, `.bizglance/intermediate/codegraph-context.json`, and the four `*-findings.json` files, then writes `.bizglance/intermediate/review-warnings.json`.
- Create `skills/bizglance/tests/validate-findings-script.test.ts`: script contract tests for missing evidence, invented paths, dangling object references, and high confidence without evidence.
- Modify `skills/bizglance/scripts/merge-business-findings.mjs`: preserve review warnings and optionally apply deterministic removals or confidence downgrades if the review output asks for them.
- Modify `packages/cli/src/commands/workflow.ts`: run `validate-findings.mjs` in the generated-context path, pass review warnings into `runAnalyzeCommand` through `transformDocument`, and preserve existing manual `--context` behavior.
- Modify `packages/cli/tests/workflow-command.test.ts`: unit-test review warning injection and generated-context orchestration order.
- Modify `packages/cli/tests/workflow.test.ts`: add realistic project workflow test with controllers, services, entities, status mutation, and field calculation candidates.
- Modify `skills/bizglance/SKILL.md`: document the deterministic review step as mandatory after agent findings and before assemble.
- Modify `skills/bizglance/tests/skill-content.test.ts`: require `validate-findings.mjs` and `review-warnings.json` in the skill contract.

## Intermediate Contract

`validate-findings.mjs` must write:

```json
{
  "warnings": [
    {
      "code": "missing-evidence",
      "severity": "warning",
      "target": "flows[0]",
      "message": "flows[0] 缺少 evidence，不能作为高置信度业务关系。"
    }
  ],
  "downgrades": [
    {
      "target": "flows[0]",
      "confidence": "low",
      "reason": "缺少 evidence。"
    }
  ],
  "removals": [],
  "normalizations": []
}
```

Rules:

- `warnings[]` is always non-fatal.
- `downgrades[]` may be applied by merge script.
- `removals[]` is reserved for future use in this plan; do not remove findings automatically in this iteration.
- `normalizations[]` is reserved for future use in this plan; do not rewrite names automatically in this iteration.

## Task 1: Findings Review Script

**Files:**

- Create: `skills/bizglance/scripts/validate-findings.mjs`
- Create: `skills/bizglance/tests/validate-findings-script.test.ts`

- [ ] **Step 1: Write failing test for missing evidence downgrade**

Add this test to `skills/bizglance/tests/validate-findings-script.test.ts`:

```ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const tmpRoot = resolve("E:/code/biz-glance/tmp/validate-findings-tests");
const scriptPath = resolve("E:/code/biz-glance/skills/bizglance/scripts/validate-findings.mjs");

async function resetIntermediate(name: string) {
  const intermediateDir = resolve(tmpRoot, name, ".bizglance/intermediate");
  await rm(resolve(tmpRoot, name), { recursive: true, force: true });
  await mkdir(intermediateDir, { recursive: true });
  await writeFile(
    resolve(intermediateDir, "repo-context.json"),
    JSON.stringify(
      {
        repo: { name: "billing", root: "E:/tmp/billing" },
        entityCandidates: [{ filePath: "src/domain/Invoice.ts", technicalName: "Invoice", line: 1 }]
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    resolve(intermediateDir, "codegraph-context.json"),
    JSON.stringify(
      {
        nodes: [{ name: "Invoice", filePath: "src/domain/Invoice.ts", startLine: 1, endLine: 12 }],
        relatedFiles: ["src/domain/Invoice.ts"]
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    resolve(intermediateDir, "business-object-findings.json"),
    JSON.stringify([{ technicalName: "Invoice", name: "发票" }], null, 2),
    "utf8"
  );
  await writeFile(resolve(intermediateDir, "status-mutation-findings.json"), "[]", "utf8");
  await writeFile(resolve(intermediateDir, "field-lineage-findings.json"), "[]", "utf8");
  return intermediateDir;
}

describe("validate-findings script", () => {
  it("warns and downgrades high-confidence flows without evidence", async () => {
    const intermediateDir = await resetIntermediate("missing-evidence");
    await writeFile(
      resolve(intermediateDir, "business-flow-findings.json"),
      JSON.stringify(
        {
          flows: [
            {
              from: "Invoice",
              to: "Payment",
              relation: "creates",
              label: "开票后创建支付记录",
              confidence: "high"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const { validateFindings } = await import(pathToFileURL(scriptPath).href);
    await validateFindings({ intermediateDir });

    const review = JSON.parse(await readFile(resolve(intermediateDir, "review-warnings.json"), "utf8")) as {
      warnings: Array<{ code: string; target: string }>;
      downgrades: Array<{ target: string; confidence: string }>;
    };

    expect(review.warnings).toEqual([
      expect.objectContaining({ code: "missing-evidence", target: "flows[0]" }),
      expect.objectContaining({ code: "dangling-object-reference", target: "flows[0].to" })
    ]);
    expect(review.downgrades).toEqual([
      expect.objectContaining({ target: "flows[0]", confidence: "low" })
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run skills/bizglance/tests/validate-findings-script.test.ts
```

Expected: FAIL because `skills/bizglance/scripts/validate-findings.mjs` does not exist.

- [ ] **Step 3: Implement minimal validate-findings script**

Create `skills/bizglance/scripts/validate-findings.mjs`:

```js
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
      addWarning(review, "dangling-object-reference", `${target}.from`, `${target}.from 引用了未知业务对象: ${finding.from}。`);
    }
    if (finding.to && !knownObjects.has(finding.to)) {
      addWarning(review, "dangling-object-reference", `${target}.to`, `${target}.to 引用了未知业务对象: ${finding.to}。`);
    }
  });

  statusMutations.forEach((finding, index) => {
    const target = `statusMutations[${index}]`;
    reviewEvidence(review, target, finding, knownFiles);
    if (finding.object && !knownObjects.has(finding.object)) {
      addWarning(review, "dangling-object-reference", `${target}.object`, `${target}.object 引用了未知业务对象: ${finding.object}。`);
    }
  });

  fieldLineages.forEach((finding, index) => {
    const target = `fieldLineages[${index}]`;
    reviewEvidence(review, target, finding, knownFiles);
    if (finding.object && !knownObjects.has(finding.object)) {
      addWarning(review, "dangling-object-reference", `${target}.object`, `${target}.object 引用了未知业务对象: ${finding.object}。`);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run skills/bizglance/tests/validate-findings-script.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add skills/bizglance/scripts/validate-findings.mjs skills/bizglance/tests/validate-findings-script.test.ts
git commit -m "feat: add deterministic findings review script"
```

## Task 2: Apply Confidence Downgrades During Merge

**Files:**

- Modify: `skills/bizglance/scripts/merge-business-findings.mjs`
- Modify: `skills/bizglance/tests/merge-business-findings-script.test.ts`

- [ ] **Step 1: Write failing merge downgrade test**

Add this test to `skills/bizglance/tests/merge-business-findings-script.test.ts`:

```ts
it("applies review downgrades before writing merged context", async () => {
  const { intermediate } = await resetWorkspace();
  const output = resolve(intermediate, "codegraph-assisted-input.json");
  await writeFile(
    resolve(intermediate, "review-warnings.json"),
    JSON.stringify(
      {
        warnings: [],
        downgrades: [{ target: "flows[0]", confidence: "low", reason: "缺少 evidence。" }],
        removals: [],
        normalizations: []
      },
      null,
      2
    ),
    "utf8"
  );
  const { mergeBusinessFindings } = await import(pathToFileURL(scriptPath).href);

  await mergeBusinessFindings({ intermediateDir: intermediate, output });

  const merged = JSON.parse(await readFile(output, "utf8")) as {
    findings: { flows: Array<{ confidence: string }> };
  };
  expect(merged.findings.flows[0].confidence).toBe("low");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run skills/bizglance/tests/merge-business-findings-script.test.ts
```

Expected: FAIL because merge does not read `review-warnings.json`.

- [ ] **Step 3: Implement downgrade application**

Modify `skills/bizglance/scripts/merge-business-findings.mjs` by adding these helpers:

```js
async function readReviewWarnings(intermediateDir) {
  return await readJsonIfExists(resolve(intermediateDir, "review-warnings.json"), {
    warnings: [],
    downgrades: [],
    removals: [],
    normalizations: []
  });
}

function applyDowngrades(findings, review) {
  for (const downgrade of review.downgrades ?? []) {
    const match = /^(flows|statusMutations|fieldLineages)\[(\d+)\]$/.exec(downgrade.target);
    if (!match) {
      continue;
    }

    const [, collectionName, indexText] = match;
    const index = Number(indexText);
    const collection = findings[collectionName];
    if (Array.isArray(collection) && collection[index]) {
      collection[index] = {
        ...collection[index],
        confidence: downgrade.confidence
      };
    }
  }

  return findings;
}
```

Then call it after building `findings`:

```js
const review = await readReviewWarnings(intermediateDir);
const merged = {
  codegraph,
  findings: applyDowngrades(findings, review),
  review
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run skills/bizglance/tests/merge-business-findings-script.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add skills/bizglance/scripts/merge-business-findings.mjs skills/bizglance/tests/merge-business-findings-script.test.ts
git commit -m "feat: apply review downgrades during findings merge"
```

## Task 3: Workflow Review Integration

**Files:**

- Modify: `packages/cli/src/commands/workflow.ts`
- Modify: `packages/cli/tests/workflow-command.test.ts`

- [ ] **Step 1: Write failing workflow orchestration test**

Add this test to `packages/cli/tests/workflow-command.test.ts`:

```ts
it("runs findings review before analyze when generated context is needed", async () => {
  const calls: string[] = [];

  await runWorkflowCommand({
    repo: "E:/code/biz-glance",
    noServe: true,
    initCommand: async () => ({
      repo: "E:/code/biz-glance",
      workspaceDir: "E:/code/biz-glance/.bizglance",
      createdConfig: true
    }),
    fileExists: async () => false,
    generateContext: async () => {
      calls.push("generate");
      return "E:/code/biz-glance/.bizglance/intermediate/codegraph-assisted-input.json";
    },
    reviewFindings: async (options) => {
      calls.push(`review:${options.intermediateDir.replace(/\\/g, "/")}`);
      return {
        warnings: [{ code: "missing-evidence", severity: "warning", target: "flows[0]", message: "缺少 evidence。" }],
        downgrades: [],
        removals: [],
        normalizations: []
      };
    },
    analyzeCommand: async (options) => {
      calls.push("analyze");
      expect(options.transformDocument).toBeTypeOf("function");
    },
    validateCommand: async () => {
      calls.push("validate");
      return { kind: "document", valid: true, errors: [], warnings: [] };
    }
  });

  expect(calls).toEqual([
    "generate",
    "review:E:/code/biz-glance/.bizglance/intermediate",
    "analyze",
    "validate"
  ]);
});
```

- [ ] **Step 2: Update the test type expectation**

The current `analyzeCommand` option type in `packages/cli/src/commands/workflow.ts` does not expose `transformDocument`. Update the test only after the production type is changed in Step 4.

- [ ] **Step 3: Run test to verify it fails**

Run:

```powershell
pnpm --filter @bizglance/cli test tests/workflow-command.test.ts
```

Expected: FAIL because `reviewFindings` is not a recognized workflow option.

- [ ] **Step 4: Add workflow review option and document transform**

In `packages/cli/src/commands/workflow.ts`, add a `ReviewFindingsResult` type:

```ts
type ReviewFindingsResult = {
  warnings: Array<{ code: string; severity: string; target: string; message: string }>;
  downgrades: Array<{ target: string; confidence: "high" | "medium" | "low"; reason: string }>;
  removals: unknown[];
  normalizations: unknown[];
};
```

Change `analyzeCommand` option type to include `transformDocument`:

```ts
transformDocument?: (document: BizGlanceDocument) => Promise<BizGlanceDocument> | BizGlanceDocument;
```

Import `type BizGlanceDocument` from core:

```ts
import type { BizGlanceDocument } from "../../../core/src/index";
```

Add a default reviewer:

```ts
async function defaultReviewFindings(options: { intermediateDir: string }): Promise<ReviewFindingsResult> {
  const validateScriptPath = resolve(REPO_ROOT, "skills/bizglance/scripts/validate-findings.mjs");
  const { validateFindings } = await import(pathToFileURL(validateScriptPath).href);
  return await validateFindings({ intermediateDir: options.intermediateDir });
}
```

Add `reviewFindings` to `runWorkflowCommand` options:

```ts
reviewFindings?: (options: { intermediateDir: string }) => Promise<ReviewFindingsResult>;
```

Initialize it:

```ts
const reviewFindings = options.reviewFindings ?? defaultReviewFindings;
let reviewResult: ReviewFindingsResult | undefined;
```

After generated context is created, run the reviewer:

```ts
if (!options.codegraphContext) {
  reviewResult = await reviewFindings({ intermediateDir: paths.intermediateDir });
}
```

Pass warnings into analyze:

```ts
transformDocument: reviewResult
  ? (document) => ({
      ...document,
      meta: {
        ...document.meta,
        warnings: [
          ...document.meta.warnings,
          ...reviewResult.warnings.map((warning) => `${warning.code}: ${warning.message}`)
        ]
      }
    })
  : undefined
```

- [ ] **Step 5: Run workflow command test**

Run:

```powershell
pnpm --filter @bizglance/cli test tests/workflow-command.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/cli/src/commands/workflow.ts packages/cli/tests/workflow-command.test.ts
git commit -m "feat: integrate findings review into workflow"
```

## Task 4: Realistic Project Acceptance Fixture

**Files:**

- Modify: `packages/cli/tests/workflow.test.ts`

- [ ] **Step 1: Write realistic temp project test**

Add this test to `packages/cli/tests/workflow.test.ts`:

```ts
it("generates useful candidates and warnings for a realistic billing project", async () => {
  const repo = resolve(tmpRoot, "realistic-billing-project");

  await resetDir(repo);
  await writeFile(resolve(repo, "README.md"), "# Billing Service\n\nCreates invoices, issues payments, and tracks invoice status.\n", "utf8");
  await mkdir(resolve(repo, "src/controllers"), { recursive: true });
  await mkdir(resolve(repo, "src/domain"), { recursive: true });
  await mkdir(resolve(repo, "src/services"), { recursive: true });
  await writeFile(
    resolve(repo, "package.json"),
    JSON.stringify({ name: "billing-service", dependencies: { express: "^5.0.0" } }, null, 2),
    "utf8"
  );
  await writeFile(
    resolve(repo, "src/domain/Invoice.ts"),
    [
      "export interface Invoice {",
      "  id: string;",
      "  status: 'draft' | 'issued' | 'paid';",
      "  subtotal: number;",
      "  taxAmount: number;",
      "  totalAmount: number;",
      "}"
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    resolve(repo, "src/controllers/InvoiceController.ts"),
    [
      "export class InvoiceController {",
      "  async issueInvoice() {",
      "    return '/api/invoices/issue';",
      "  }",
      "}"
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    resolve(repo, "src/services/InvoiceService.ts"),
    [
      "export class InvoiceService {",
      "  issueInvoice(invoice: { status: string }) {",
      "    invoice.status = 'issued';",
      "  }",
      "  calculateTotal(subtotal: number, taxAmount: number) {",
      "    return subtotal + taxAmount;",
      "  }",
      "}"
    ].join("\n"),
    "utf8"
  );

  const result = await runWorkflowCommand({ repo, noServe: true });
  const repoContext = JSON.parse(await readFile(resolve(repo, ".bizglance/intermediate/repo-context.json"), "utf8")) as {
    entrypoints: Array<{ filePath: string; route?: string }>;
    entityCandidates: Array<{ technicalName: string }>;
    statusCandidates: Array<{ field: string }>;
    fieldCandidates: Array<{ field: string }>;
  };
  const document = JSON.parse(await readFile(result.outputPath, "utf8")) as {
    businessObjects: Array<{ technicalName?: string }>;
    meta: { warnings: string[] };
  };

  expect(repoContext.entrypoints).toEqual([
    expect.objectContaining({ filePath: "src/controllers/InvoiceController.ts" }),
    expect.objectContaining({ route: "/api/invoices/issue" })
  ]);
  expect(repoContext.entityCandidates).toEqual([
    expect.objectContaining({ technicalName: "Invoice" })
  ]);
  expect(repoContext.statusCandidates.map((item) => item.field)).toContain("status");
  expect(repoContext.fieldCandidates.map((item) => item.field)).toEqual(
    expect.arrayContaining(["subtotal", "taxAmount", "totalAmount"])
  );
  expect(document.businessObjects.map((item) => item.technicalName)).toContain("Invoice");
});
```

- [ ] **Step 2: Run test**

Run:

```powershell
pnpm --filter @bizglance/cli test tests/workflow.test.ts
```

Expected: PASS if the current preprocessor catches the realistic project. If it fails on missing `taxAmount` or `totalAmount`, improve `collect-repo-context.mjs` field extraction with a failing script test first.

- [ ] **Step 3: Commit**

```powershell
git add packages/cli/tests/workflow.test.ts
git commit -m "test: add realistic billing workflow acceptance"
```

## Task 5: Skill Contract Update

**Files:**

- Modify: `skills/bizglance/SKILL.md`
- Modify: `skills/bizglance/tests/skill-content.test.ts`

- [ ] **Step 1: Write failing skill content test**

Add these assertions to `skills/bizglance/tests/skill-content.test.ts`:

```ts
expect(content).toContain("validate-findings.mjs");
expect(content).toContain("review-warnings.json");
expect(content).toContain("evidence-reviewer");
expect(content).toContain("business-graph-reviewer");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run skills/bizglance/tests/skill-content.test.ts
```

Expected: FAIL if the skill does not mention `validate-findings.mjs` or `review-warnings.json`.

- [ ] **Step 3: Update skill workflow text**

In `skills/bizglance/SKILL.md`, update Phase 3.5 to:

```md
## Phase 3.5: Deterministic Review

Always run `skills/bizglance/scripts/validate-findings.mjs` after agent findings are present and before assemble. Save the output as `.bizglance/intermediate/review-warnings.json`.

Then run the prompt reviewers when the user passes `--review`, when high-confidence findings have weak evidence, or when deterministic review emits warnings:

- `evidence-reviewer`
- `business-graph-reviewer`

Reviewers must not add new business conclusions. They may recommend warnings, downgrades, removals, or normalizations.
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run skills/bizglance/tests/skill-content.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add skills/bizglance/SKILL.md skills/bizglance/tests/skill-content.test.ts
git commit -m "docs: require deterministic findings review in bizglance skill"
```

## Task 6: Integration Verification

**Files:**

- No production files unless a verification failure exposes a bug.

- [ ] **Step 1: Run script tests**

Run:

```powershell
pnpm exec vitest run skills/bizglance/tests
```

Expected: all tests pass.

- [ ] **Step 2: Run CLI tests**

Run:

```powershell
pnpm --filter @bizglance/cli test
```

Expected: all tests pass.

- [ ] **Step 3: Run full test suite**

Run:

```powershell
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
pnpm -r typecheck
```

Expected: all packages typecheck.

- [ ] **Step 5: Run smoke test**

Run:

```powershell
pnpm smoke
```

Expected: smoke output reports business objects, flows, status mutations, field lineages, and evidence counts.

- [ ] **Step 6: Commit verification-only docs if needed**

If no files changed during verification, do not create a commit. If documentation needed correction, commit it:

```powershell
git add docs/superpowers/plans/2026-06-07-bizglance-real-project-analysis-quality.md
git commit -m "docs: plan real project analysis quality improvements"
```

## Success Criteria

After this plan is implemented:

- `bizglance workflow <repo> --no-serve` still works without manual context.
- `.bizglance/intermediate/review-warnings.json` is produced in generated-context mode.
- High-confidence findings without evidence are downgraded before merge.
- Dangling object references are reported as warnings.
- Final `.bizglance/bizglance.json` contains review warning summaries in `meta.warnings`.
- A realistic billing-style temp project test proves entrypoints, entities, status fields, and calculated fields are discovered.
- Manual `--context` mode remains supported and is not forced through generated-context review.

## Deliberately Out of Scope

- Direct API calls to LLM providers from the CLI.
- Full AST parsing or tree-sitter integration.
- Automatic deletion of findings based on reviewer output.
- Rewriting business names or modules without LLM agent output.
- Web UI redesign.
- Git incremental analysis based on changed files.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-bizglance-real-project-analysis-quality.md`.

Recommended execution approach:

1. Subagent-Driven: dispatch one worker for script validation and merge behavior, one worker for workflow integration, then run reviewer checks.
2. Inline Execution: use `superpowers:executing-plans` task-by-task in this session.

For this repo, prefer Inline Execution if only one agent is available, because the touched files are tightly coupled around workflow and scripts.
