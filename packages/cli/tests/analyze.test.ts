import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { BizGlanceDocument } from "../../core/src/index";
import { runAnalyzeCommand } from "../src/commands/analyze";
import { prepareRepositoryInput } from "../src/utils/repoInput";

const output = resolve("E:/code/biz-glance/tmp/sample-output.json");

function createMemoryWriter() {
  const writes: Array<{ filePath: string; document: BizGlanceDocument }> = [];

  return {
    writes,
    writeDocument: async (filePath: string, document: BizGlanceDocument) => {
      writes.push({ filePath, document });
    }
  };
}

describe("cli analyze", () => {
  it("writes a sample document", async () => {
    const writer = createMemoryWriter();

    await runAnalyzeCommand({
      sample: "education",
      out: output,
      writeDocument: writer.writeDocument
    });

    expect(writer.writes[0].filePath).toBe(output);
    expect(writer.writes[0].document.meta.source.kind).toBe("sample");
  });

  it("fails when sample and repo are both provided", async () => {
    await expect(
      runAnalyzeCommand({
        sample: "education",
        repo: "E:/code/biz-glance",
        out: "tmp/out.json"
      })
    ).rejects.toThrow("必须且只能提供 --sample 或仓库路径其中一个参数。");
  });

  it("resolves relative output paths from INIT_CWD", async () => {
    const previousInitCwd = process.env.INIT_CWD;
    const relativeOutput = "tmp/relative-output.json";
    const absoluteOutput = resolve("E:/code/biz-glance", relativeOutput);
    const writer = createMemoryWriter();

    process.env.INIT_CWD = "E:/code/biz-glance";

    try {
      await runAnalyzeCommand({
        sample: "education",
        out: relativeOutput,
        writeDocument: writer.writeDocument
      });

      expect(writer.writes[0].filePath).toBe(absoluteOutput);
      expect(writer.writes[0].document.meta.source.kind).toBe("sample");
    } finally {
      process.env.INIT_CWD = previousInitCwd;
    }
  });

  it("uses a default output path and accepts the short context option", async () => {
    const previousInitCwd = process.env.INIT_CWD;
    const writer = createMemoryWriter();

    process.env.INIT_CWD = "E:/code/biz-glance";

    try {
      await runAnalyzeCommand({
        repo: ".",
        context: "fixtures/codegraph/shop-context.json",
        writeDocument: writer.writeDocument,
        readTextFile: async (filePath) => {
          expect(filePath.replace(/\\/g, "/")).toBe(
            "E:/code/biz-glance/fixtures/codegraph/shop-context.json"
          );

          return JSON.stringify({
            codegraph: { nodes: [], edges: [], codeBlocks: [], relatedFiles: [] },
            findings: {
              businessObjects: [{ technicalName: "Product", name: "商品" }],
              flows: [],
              statusMutations: [],
              fieldLineages: []
            }
          });
        }
      });

      expect(writer.writes[0].filePath).toBe("E:\\code\\biz-glance\\dist\\bizglance.json");
      expect(writer.writes[0].document.meta.source.lens).toBe("codegraph-assisted");
    } finally {
      process.env.INIT_CWD = previousInitCwd;
    }
  });

  it("defaults repository analysis to the current workspace when only context is provided", async () => {
    const previousInitCwd = process.env.INIT_CWD;
    const writer = createMemoryWriter();

    process.env.INIT_CWD = "E:/code/biz-glance";

    try {
      await runAnalyzeCommand({
        context: "fixtures/codegraph/shop-context.json",
        writeDocument: writer.writeDocument,
        readTextFile: async () =>
          JSON.stringify({
            codegraph: { nodes: [], edges: [], codeBlocks: [], relatedFiles: [] },
            findings: {
              businessObjects: [{ technicalName: "Product", name: "商品" }],
              flows: [],
              statusMutations: [],
              fieldLineages: []
            }
          })
      });

      expect(writer.writes[0].document.meta.source.path).toBe("E:\\code\\biz-glance");
    } finally {
      process.env.INIT_CWD = previousInitCwd;
    }
  });

  it("resolves relative CodeGraph context paths from INIT_CWD", async () => {
    const previousInitCwd = process.env.INIT_CWD;
    const outputPath = resolve("E:/code/biz-glance/tmp/repo-output.json");
    const writer = createMemoryWriter();

    process.env.INIT_CWD = "E:/code/biz-glance";

    try {
      await runAnalyzeCommand({
        repo: ".",
        codegraphContext: "fixtures/codegraph/shop-context.json",
        out: outputPath,
        writeDocument: writer.writeDocument,
        readTextFile: async (filePath) => {
          expect(filePath.replace(/\\/g, "/")).toBe(
            "E:/code/biz-glance/fixtures/codegraph/shop-context.json"
          );

          return JSON.stringify({
            codegraph: { nodes: [], edges: [], codeBlocks: [], relatedFiles: [] },
            findings: {
              businessObjects: [{ technicalName: "Product", name: "商品" }],
              flows: [],
              statusMutations: [],
              fieldLineages: []
            }
          });
        }
      });

      const document = writer.writes[0].document;
      expect(writer.writes[0].filePath).toBe(outputPath);
      expect(document.meta.source.lens).toBe("codegraph-assisted");
      expect(document.businessObjects[0].technicalName).toBe("Product");
    } finally {
      process.env.INIT_CWD = previousInitCwd;
    }
  });

  it("rejects remote repository URLs", async () => {
    await expect(
      prepareRepositoryInput("https://github.com/example/shop", (value) => value)
    ).rejects.toThrow("只支持本地仓库路径");

    await expect(
      prepareRepositoryInput("git@github.com:example/shop.git", (value) => value)
    ).rejects.toThrow("只支持本地仓库路径");
  });

  it("analyzes a repository with external CodeGraph and LLM context", async () => {
    const outputPath = resolve("E:/code/biz-glance/tmp/codegraph-output.json");
    const writer = createMemoryWriter();

    await runAnalyzeCommand({
      repo: ".",
      lens: "codegraph-assisted",
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      out: outputPath,
      writeDocument: writer.writeDocument,
      readTextFile: async (filePath) => {
        expect(filePath.replace(/\\/g, "/")).toBe(
          "E:/code/biz-glance/fixtures/codegraph/shop-context.json"
        );

        return JSON.stringify({
          codegraph: {
            query: "Analyze business objects",
            summary: "Found product controller and entity",
            nodes: [
              {
                kind: "class",
                name: "Product",
                qualifiedName: "com.example.shop.domain.Product",
                filePath: "src/main/java/com/example/shop/domain/Product.java",
                language: "java",
                startLine: 8,
                endLine: 42
              }
            ],
            edges: [],
            codeBlocks: [],
            relatedFiles: [],
            stats: {
              nodeCount: 1,
              edgeCount: 0,
              fileCount: 1,
              codeBlockCount: 0,
              totalCodeSize: 0
            }
          },
          findings: {
            businessObjects: [
              {
                technicalName: "Product",
                name: "商品",
                module: "catalog",
                evidence: {
                  nodeName: "Product",
                  summary: "LLM 基于 CodeGraph class 节点识别商品领域对象"
                }
              }
            ],
            flows: [],
            statusMutations: [],
            fieldLineages: []
          }
        });
      },
      prepareRepositoryInput: async () => ({
        root: "E:/code/biz-glance",
        displayName: "biz-glance",
        sourcePath: "E:/code/biz-glance",
        cleanup: async () => {}
      })
    });

    const document = writer.writes[0].document;

    expect(document.meta.source.lens).toBe("codegraph-assisted");
    expect(document.meta.source.name).toBe("biz-glance");
    expect(document.meta.source.path).toBe("E:/code/biz-glance");
    expect(document.businessObjects[0]).toMatchObject({
      id: "product",
      name: "商品",
      technicalName: "Product"
    });
  });

  it("requires CodeGraph context for repository analysis", async () => {
    await expect(
      runAnalyzeCommand({
        repo: "E:/code/biz-glance",
        out: output
      })
    ).rejects.toThrow("分析仓库时必须提供 --context。");
  });

  it("rejects legacy Java/Spring lens", async () => {
    await expect(
      runAnalyzeCommand({
        repo: "E:/code/biz-glance",
        lens: "java-spring",
        codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
        out: output
      })
    ).rejects.toThrow("当前仅支持 codegraph-assisted lens。");
  });

  it("prepares a local repository path without network fetchers", async () => {
    const repository = await prepareRepositoryInput(".", (value) => resolve("E:/code/biz-glance", value));

    expect(repository.displayName).toBe("biz-glance");
    expect(repository.sourcePath).toBe(resolve("E:/code/biz-glance", "."));
    await repository.cleanup();
  });
});
