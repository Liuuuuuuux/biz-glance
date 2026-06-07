import { describe, expect, it } from "vitest";
import { runWorkflowCommand } from "../src/commands/workflow";

describe("cli workflow command", () => {
  it("runs init, analyze, validate, and serve in order", async () => {
    const calls: string[] = [];

    const result = await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      initCommand: async () => {
        calls.push("init");
        return { repo: "E:/code/biz-glance", workspaceDir: "E:/code/biz-glance/.bizglance", createdConfig: true };
      },
      analyzeCommand: async () => {
        calls.push("analyze");
      },
      validateCommand: async () => {
        calls.push("validate");
        return { kind: "document", valid: true, errors: [], warnings: [] };
      },
      serveCommand: async () => {
        calls.push("serve");
        return "http://localhost:4173/?data=%2Fcurrent.bizglance.json";
      }
    });

    expect(calls).toEqual(["init", "analyze", "validate", "serve"]);
    expect(result.outputPath.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance/bizglance.json");
    expect(result.previewUrl).toBe("http://localhost:4173/?data=%2Fcurrent.bizglance.json");
  });

  it("skips serve when noServe is enabled", async () => {
    const calls: string[] = [];

    const result = await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      noServe: true,
      initCommand: async () => {
        calls.push("init");
        return { repo: "E:/code/biz-glance", workspaceDir: "E:/code/biz-glance/.bizglance", createdConfig: true };
      },
      analyzeCommand: async () => {
        calls.push("analyze");
      },
      validateCommand: async () => {
        calls.push("validate");
        return { kind: "document", valid: true, errors: [], warnings: [] };
      },
      serveCommand: async () => {
        calls.push("serve");
        return "unexpected";
      }
    });

    expect(calls).toEqual(["init", "analyze", "validate"]);
    expect(result.previewUrl).toBeUndefined();
  });

  it("uses the .bizglance default output path", async () => {
    const result = await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      noServe: true,
      initCommand: async () => ({
        repo: "E:/code/biz-glance",
        workspaceDir: "E:/code/biz-glance/.bizglance",
        createdConfig: true
      }),
      analyzeCommand: async (options) => {
        expect(options.out?.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance/bizglance.json");
      },
      validateCommand: async (options) => {
        expect(options.input?.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance/bizglance.json");
        return { kind: "document", valid: true, errors: [], warnings: [] };
      }
    });

    expect(result.workspaceDir.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance");
  });

  it("uses cached intermediate input when context is omitted in normal mode", async () => {
    let analyzeContextPath: string | undefined;

    await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      noServe: true,
      initCommand: async () => ({
        repo: "E:/code/biz-glance",
        workspaceDir: "E:/code/biz-glance/.bizglance",
        createdConfig: true
      }),
      fileExists: async (filePath) =>
        filePath.replace(/\\/g, "/") ===
        "E:/code/biz-glance/.bizglance/intermediate/codegraph-assisted-input.json",
      analyzeCommand: async (options) => {
        analyzeContextPath = options.codegraphContext;
      },
      validateCommand: async () => ({ kind: "document", valid: true, errors: [], warnings: [] })
    });

    expect(analyzeContextPath?.replace(/\\/g, "/")).toBe(
      "E:/code/biz-glance/.bizglance/intermediate/codegraph-assisted-input.json"
    );
  });

  it("generates an intermediate context when context and cache are omitted", async () => {
    const calls: string[] = [];
    let analyzeContextPath: string | undefined;

    await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      noServe: true,
      initCommand: async () => ({
        repo: "E:/code/biz-glance",
        workspaceDir: "E:/code/biz-glance/.bizglance",
        createdConfig: true
      }),
      fileExists: async () => false,
      generateContext: async (options) => {
        calls.push("generate");
        expect(options.repo.replace(/\\/g, "/")).toBe("E:/code/biz-glance");
        expect(options.intermediateDir.replace(/\\/g, "/")).toBe(
          "E:/code/biz-glance/.bizglance/intermediate"
        );
        return "E:/code/biz-glance/.bizglance/intermediate/codegraph-assisted-input.json";
      },
      analyzeCommand: async (options) => {
        calls.push("analyze");
        analyzeContextPath = options.codegraphContext;
      },
      validateCommand: async () => {
        calls.push("validate");
        return { kind: "document", valid: true, errors: [], warnings: [] };
      }
    });

    expect(calls).toEqual(["generate", "analyze", "validate"]);
    expect(analyzeContextPath?.replace(/\\/g, "/")).toBe(
      "E:/code/biz-glance/.bizglance/intermediate/codegraph-assisted-input.json"
    );
  });

  it("regenerates context in full mode when explicit context is omitted", async () => {
    const calls: string[] = [];

    await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      full: true,
      noServe: true,
      initCommand: async () => ({
        repo: "E:/code/biz-glance",
        workspaceDir: "E:/code/biz-glance/.bizglance",
        createdConfig: true
      }),
      fileExists: async () => true,
      generateContext: async () => {
        calls.push("generate");
        return "E:/code/biz-glance/.bizglance/intermediate/codegraph-assisted-input.json";
      },
      analyzeCommand: async (options) => {
        calls.push(`analyze:${options.codegraphContext}`);
      },
      validateCommand: async () => {
        calls.push("validate");
        return { kind: "document", valid: true, errors: [], warnings: [] };
      }
    });

    expect(calls).toEqual([
      "generate",
      "analyze:E:/code/biz-glance/.bizglance/intermediate/codegraph-assisted-input.json",
      "validate"
    ]);
  });

  it("skips analyze and validates existing output in review mode", async () => {
    const calls: string[] = [];

    const result = await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      review: true,
      noServe: true,
      initCommand: async () => ({
        repo: "E:/code/biz-glance",
        workspaceDir: "E:/code/biz-glance/.bizglance",
        createdConfig: true
      }),
      fileExists: async (filePath) =>
        filePath.replace(/\\/g, "/") === "E:/code/biz-glance/.bizglance/bizglance.json",
      analyzeCommand: async () => {
        calls.push("analyze");
      },
      validateCommand: async (options) => {
        calls.push("validate");
        expect(options.input.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance/bizglance.json");
        return { kind: "document", valid: true, errors: [], warnings: [] };
      }
    });

    expect(calls).toEqual(["validate"]);
    expect(result.outputPath.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance/bizglance.json");
  });

  it("writes the requested language into workspace config", async () => {
    const writes: Array<{ filePath: string; content: string }> = [];

    await runWorkflowCommand({
      repo: "E:/code/biz-glance",
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      language: "en",
      noServe: true,
      initCommand: async () => ({
        repo: "E:/code/biz-glance",
        workspaceDir: "E:/code/biz-glance/.bizglance",
        createdConfig: false
      }),
      readTextFile: async (filePath) => {
        expect(filePath.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance/config.json");
        return JSON.stringify({
          language: "zh",
          autoServe: true,
          defaultLens: "codegraph-assisted"
        });
      },
      writeTextFile: async (filePath, content) => {
        writes.push({ filePath, content });
      },
      analyzeCommand: async () => {},
      validateCommand: async () => ({ kind: "document", valid: true, errors: [], warnings: [] })
    });

    expect(writes).toHaveLength(1);
    expect(writes[0].filePath.replace(/\\/g, "/")).toBe("E:/code/biz-glance/.bizglance/config.json");
    expect(JSON.parse(writes[0].content)).toMatchObject({
      language: "en",
      autoServe: true,
      defaultLens: "codegraph-assisted"
    });
  });
});
