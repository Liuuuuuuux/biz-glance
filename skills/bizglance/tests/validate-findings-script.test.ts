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
