import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runAnalyzeCommand } from "../src/commands/analyze";
import { runInitCommand } from "../src/commands/init";
import { runValidateCommand } from "../src/commands/validate";
import { runWorkflowCommand } from "../src/commands/workflow";

const tmpRoot = resolve("E:/code/biz-glance/tmp/cli-workflow-tests");

async function resetDir(path: string) {
  await rm(path, { recursive: true, force: true });
  await mkdir(path, { recursive: true });
}

describe("cli workflow", () => {
  it("runs init, analyze, and validate against a .bizglance workspace", async () => {
    const repo = resolve(tmpRoot, "shop-workflow");
    const outputPath = resolve(repo, ".bizglance/bizglance.json");
    const metaPath = resolve(repo, ".bizglance/meta.json");

    await resetDir(repo);

    const initResult = await runInitCommand({ repo });

    expect(initResult.workspaceDir).toBe(resolve(repo, ".bizglance"));
    await expect(access(resolve(repo, ".bizglance/intermediate/.gitkeep"))).resolves.toBeUndefined();
    await expect(access(resolve(repo, ".bizglance/tmp/.gitkeep"))).resolves.toBeUndefined();

    await runAnalyzeCommand({
      repo,
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      out: outputPath
    });

    const validateResult = await runValidateCommand({
      input: outputPath,
      kind: "document"
    });

    expect(validateResult.valid).toBe(true);

    const document = JSON.parse(await readFile(outputPath, "utf8")) as {
      businessObjects: Array<{ technicalName?: string }>;
      meta: { source: { path?: string; lens: string } };
    };
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as {
      outputPath: string;
      contextPath: string;
      source: { path: string };
    };

    expect(document.meta.source.lens).toBe("codegraph-assisted");
    expect(document.meta.source.path).toBe(repo);
    expect(document.businessObjects.map((item) => item.technicalName)).toEqual(
      expect.arrayContaining(["Product", "Category"])
    );
    expect(meta.outputPath).toBe(outputPath.replace(/\\/g, "/"));
    expect(meta.contextPath).toBe("E:/code/biz-glance/fixtures/codegraph/shop-context.json");
    expect(meta.source.path).toBe(repo.replace(/\\/g, "/"));
  });

  it("runs the real workflow command end-to-end with noServe", async () => {
    const repo = resolve(tmpRoot, "workflow-command");

    await resetDir(repo);

    const result = await runWorkflowCommand({
      repo,
      codegraphContext: "E:/code/biz-glance/fixtures/codegraph/shop-context.json",
      noServe: true
    });

    expect(result.previewUrl).toBeUndefined();
    expect(result.outputPath.replace(/\\/g, "/")).toBe(
      `${repo.replace(/\\/g, "/")}/.bizglance/bizglance.json`
    );

    const document = JSON.parse(await readFile(result.outputPath, "utf8")) as {
      businessObjects: Array<{ technicalName?: string }>;
    };

    expect(document.businessObjects.map((item) => item.technicalName)).toEqual(
      expect.arrayContaining(["Product", "Category"])
    );
  });

  it("runs the real workflow command without a manual context", async () => {
    const repo = resolve(tmpRoot, "workflow-generated-context");

    await resetDir(repo);
    await writeFile(resolve(repo, "README.md"), "# Billing API\n\nHandles invoices.\n", "utf8");
    await mkdir(resolve(repo, "src"), { recursive: true });
    await writeFile(
      resolve(repo, "src/Invoice.ts"),
      [
        "export interface Invoice {",
        "  id: string;",
        "  status: 'draft' | 'issued';",
        "  totalAmount: number;",
        "}"
      ].join("\n"),
      "utf8"
    );

    const result = await runWorkflowCommand({
      repo,
      noServe: true
    });

    const document = JSON.parse(await readFile(result.outputPath, "utf8")) as {
      businessObjects: Array<{ technicalName?: string }>;
    };
    const generatedInput = JSON.parse(
      await readFile(resolve(repo, ".bizglance/intermediate/codegraph-assisted-input.json"), "utf8")
    ) as {
      findings: {
        businessObjects: Array<{ technicalName: string }>;
      };
    };
    const reviewWarnings = JSON.parse(
      await readFile(resolve(repo, ".bizglance/intermediate/review-warnings.json"), "utf8")
    ) as {
      warnings: string[];
      downgrades: string[];
    };

    expect(generatedInput.findings.businessObjects).toEqual([
      expect.objectContaining({ technicalName: "Invoice" })
    ]);
    expect(Array.isArray(reviewWarnings.warnings)).toBe(true);
    expect(Array.isArray(reviewWarnings.downgrades)).toBe(true);
    expect(document.businessObjects.map((item) => item.technicalName)).toContain("Invoice");
  });

  it("generates useful candidates and warnings for a realistic billing project", async () => {
    const repo = resolve(tmpRoot, "realistic-billing-project");

    await resetDir(repo);
    await writeFile(
      resolve(repo, "README.md"),
      "# Billing Service\n\nCreates invoices, issues payments, and tracks invoice status.\n",
      "utf8"
    );
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

    expect(repoContext.entrypoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filePath: "src/controllers/InvoiceController.ts" }),
        expect.objectContaining({ route: "/api/invoices/issue" })
      ])
    );
    expect(repoContext.entityCandidates).toEqual([
      expect.objectContaining({ technicalName: "Invoice" })
    ]);
    expect(repoContext.statusCandidates.map((item) => item.field)).toContain("status");
    expect(repoContext.fieldCandidates.map((item) => item.field)).toEqual(
      expect.arrayContaining(["subtotal", "taxAmount", "totalAmount"])
    );
    expect(document.businessObjects.map((item) => item.technicalName)).toContain("Invoice");
    expect(Array.isArray(document.meta.warnings)).toBe(true);
  });
});
