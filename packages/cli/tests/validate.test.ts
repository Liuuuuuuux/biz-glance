import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runValidateCommand } from "../src/commands/validate";
import type { BizGlanceDocument } from "../../core/src/index";

const tmpRoot = resolve("E:/code/biz-glance/tmp/cli-validate-tests");

const validDocument: BizGlanceDocument = {
  meta: {
    version: "0.1.0",
    generatedAt: "2026-06-07T00:00:00.000Z",
    source: {
      kind: "repo",
      name: "shop",
      lens: "codegraph-assisted"
    },
    warnings: []
  },
  businessObjects: [{ id: "product", name: "商品", technicalName: "Product" }],
  flows: [],
  statusMutations: [],
  fieldLineages: [],
  evidences: []
};

async function writeJson(name: string, value: unknown) {
  await mkdir(tmpRoot, { recursive: true });
  const filePath = resolve(tmpRoot, name);
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  return filePath;
}

describe("cli validate", () => {
  it("validates a BizGlance document file", async () => {
    const input = await writeJson("valid-document.json", validDocument);

    const result = await runValidateCommand({ input, kind: "document" });

    expect(result.valid).toBe(true);
    expect(result.kind).toBe("document");
    expect(result.errors).toEqual([]);
  });

  it("throws clear errors for an invalid BizGlance document", async () => {
    const input = await writeJson("invalid-document.json", {
      ...validDocument,
      flows: undefined
    });

    await expect(runValidateCommand({ input, kind: "document" })).rejects.toThrow(
      "BizGlance 校验失败"
    );
  });

  it("validates a CodeGraph-assisted context file", async () => {
    const input = await writeJson("valid-context.json", {
      codegraph: {
        nodes: [],
        edges: [],
        codeBlocks: [],
        relatedFiles: []
      },
      findings: {
        businessObjects: [{ technicalName: "Product", name: "商品" }],
        flows: []
      }
    });

    const result = await runValidateCommand({ input, kind: "context" });

    expect(result.valid).toBe(true);
    expect(result.kind).toBe("context");
  });

  it("auto-detects final documents by meta and source fields", async () => {
    const input = await writeJson("auto-document.json", validDocument);

    const result = await runValidateCommand({ input });

    expect(result.kind).toBe("document");
  });

  it("rejects unsupported validation kinds", async () => {
    const input = await writeJson("valid-kind-document.json", validDocument);

    await expect(
      runValidateCommand({ input, kind: "unknown" as "document" })
    ).rejects.toThrow("validate --kind 仅支持 auto、document 或 context。");
  });
});
