import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { BizGlanceDocument } from "../../core/src/index";
import { runAnalyzeCommand } from "../src/commands/analyze";
import { parseGitHubRepository, prepareRepositoryInput } from "../src/utils/repoInput";

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
        repo: "E:/code/biz-glance/fixtures/java-spring-mini",
        out: "tmp/out.json"
      })
    ).rejects.toThrow("必须且只能提供 --sample 或 --repo 其中一个参数。");
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

  it("resolves relative repo paths from INIT_CWD", async () => {
    const previousInitCwd = process.env.INIT_CWD;
    const outputPath = resolve("E:/code/biz-glance/tmp/repo-output.json");
    const writer = createMemoryWriter();

    process.env.INIT_CWD = "E:/code/biz-glance";

    try {
      await runAnalyzeCommand({
        repo: "./fixtures/java-spring-mini",
        out: outputPath,
        writeDocument: writer.writeDocument
      });

      const document = writer.writes[0].document;
      expect(writer.writes[0].filePath).toBe(outputPath);
      expect(document.businessObjects.length).toBeGreaterThan(0);
    } finally {
      process.env.INIT_CWD = previousInitCwd;
    }
  });

  it("parses common GitHub repository URL forms", () => {
    expect(parseGitHubRepository("https://github.com/example/java-spring-mini")?.cloneUrl).toBe(
      "https://github.com/example/java-spring-mini.git"
    );
    expect(parseGitHubRepository("git@github.com:example/java-spring-mini.git")?.displayName).toBe(
      "example/java-spring-mini"
    );
    expect(parseGitHubRepository("./fixtures/java-spring-mini")).toBeNull();
  });

  it("analyzes a GitHub repository URL through the repo pipeline", async () => {
    const outputPath = resolve("E:/code/biz-glance/tmp/github-output.json");
    const writer = createMemoryWriter();
    let cleanupCalled = false;

    await runAnalyzeCommand({
      repo: "https://github.com/example/java-spring-mini",
      out: outputPath,
      writeDocument: writer.writeDocument,
      prepareRepositoryInput: async (repo) => {
        expect(repo).toBe("https://github.com/example/java-spring-mini");

        return {
          root: "E:/code/biz-glance/fixtures/java-spring-mini",
          displayName: "example/java-spring-mini",
          sourcePath: "https://github.com/example/java-spring-mini.git",
          isRemote: true,
          cleanup: async () => {
            cleanupCalled = true;
          },
          normalizeEvidencePath: (filePath) =>
            filePath.replace("E:/code/biz-glance/fixtures/java-spring-mini/", "")
        };
      }
    });

    const document = writer.writes[0].document;

    expect(cleanupCalled).toBe(true);
    expect(document.meta.source.kind).toBe("repo");
    expect(document.meta.source.name).toBe("example/java-spring-mini");
    expect(document.meta.source.path).toBe("https://github.com/example/java-spring-mini.git");
    expect(document.businessObjects.some((item) => item.technicalName === "PurchaseOrder")).toBe(true);
    expect(document.evidences.some((item) => item.filePath?.startsWith("src/"))).toBe(true);
  });

  it("analyzes a repository with external CodeGraph and LLM context", async () => {
    const outputPath = resolve("E:/code/biz-glance/tmp/codegraph-output.json");
    const writer = createMemoryWriter();

    await runAnalyzeCommand({
      repo: "https://github.com/example/shop",
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
        root: "E:/code/biz-glance/tmp/shop",
        displayName: "example/shop",
        sourcePath: "https://github.com/example/shop.git",
        isRemote: true,
        cleanup: async () => {},
        normalizeEvidencePath: (filePath) => filePath
      })
    });

    const document = writer.writes[0].document;

    expect(document.meta.source.lens).toBe("codegraph-assisted");
    expect(document.meta.source.name).toBe("example/shop");
    expect(document.meta.source.path).toBe("https://github.com/example/shop.git");
    expect(document.businessObjects[0]).toMatchObject({
      id: "product",
      name: "商品",
      technicalName: "Product"
    });
  });

  it("requires CodeGraph context when the codegraph-assisted lens is selected", async () => {
    await expect(
      runAnalyzeCommand({
        repo: "E:/code/biz-glance/fixtures/java-spring-mini",
        lens: "codegraph-assisted",
        out: output
      })
    ).rejects.toThrow("使用 codegraph-assisted lens 时必须提供 --codegraph-context。");
  });

  it("falls back to a GitHub archive download when shallow clone fails", async () => {
    const calls: string[] = [];
    const repository = await prepareRepositoryInput("https://github.com/example/shop", (value) => value, {
      clone: async () => {
        calls.push("clone");
        throw new Error("network reset");
      },
      downloadArchive: async (archiveUrl, targetPath) => {
        calls.push(`download:${archiveUrl}:${targetPath.endsWith(".tar.gz")}`);
      },
      extractArchive: async (archivePath, targetPath) => {
        calls.push(`extract:${archivePath.endsWith(".tar.gz")}:${targetPath.endsWith("shop")}`);
      }
    });

    try {
      expect(repository.displayName).toBe("example/shop");
      expect(repository.sourcePath).toBe("https://github.com/example/shop.git");
      expect(calls).toEqual([
        "clone",
        "download:https://codeload.github.com/example/shop/tar.gz/HEAD:true",
        "extract:true:true"
      ]);
    } finally {
      await repository.cleanup();
    }
  });
});
