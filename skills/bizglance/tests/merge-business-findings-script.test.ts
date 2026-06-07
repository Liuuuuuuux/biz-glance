import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const tmpRoot = resolve("E:/code/biz-glance/tmp/merge-business-findings-tests");
const scriptPath = resolve("E:/code/biz-glance/skills/bizglance/scripts/merge-business-findings.mjs");

async function resetWorkspace() {
  const workspace = resolve(tmpRoot, "workspace");
  const intermediate = resolve(workspace, "intermediate");
  await rm(workspace, { recursive: true, force: true });
  await mkdir(intermediate, { recursive: true });

  await writeFile(
    resolve(intermediate, "codegraph-context.json"),
    JSON.stringify(
      {
        summary: "Order service calls payment service.",
        nodes: [],
        edges: [],
        codeBlocks: [],
        relatedFiles: []
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    resolve(intermediate, "business-object-findings.json"),
    JSON.stringify([
      {
        technicalName: "Order",
        name: "订单"
      }
    ]),
    "utf8"
  );
  await writeFile(
    resolve(intermediate, "business-flow-findings.json"),
    JSON.stringify({
      flows: [
        {
          from: "Order",
          to: "Payment",
          relation: "creates",
          label: "订单提交后创建支付记录",
          confidence: "high"
        }
      ]
    }),
    "utf8"
  );
  await writeFile(resolve(intermediate, "status-mutation-findings.json"), "[]", "utf8");
  await writeFile(
    resolve(intermediate, "field-lineage-findings.json"),
    JSON.stringify({
      fieldLineages: []
    }),
    "utf8"
  );

  return { workspace, intermediate };
}

describe("merge-business-findings script", () => {
  it("merges agent findings into the CodeGraph-assisted input contract", async () => {
    const { intermediate } = await resetWorkspace();
    const output = resolve(intermediate, "codegraph-assisted-input.json");
    const { mergeBusinessFindings } = await import(pathToFileURL(scriptPath).href);

    await mergeBusinessFindings({
      intermediateDir: intermediate,
      output
    });

    const merged = JSON.parse(await readFile(output, "utf8")) as {
      codegraph: { summary?: string };
      findings: {
        businessObjects: Array<{ technicalName: string }>;
        flows: Array<{ from: string; to: string; relation: string }>;
        statusMutations: unknown[];
        fieldLineages: unknown[];
      };
    };

    expect(merged.codegraph.summary).toBe("Order service calls payment service.");
    expect(merged.findings.businessObjects).toEqual([
      {
        technicalName: "Order",
        name: "订单"
      }
    ]);
    expect(merged.findings.flows).toEqual([
      expect.objectContaining({
        from: "Order",
        to: "Payment",
        relation: "creates"
      })
    ]);
    expect(merged.findings.statusMutations).toEqual([]);
    expect(merged.findings.fieldLineages).toEqual([]);
  });

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
});
