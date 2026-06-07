import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const tmpRoot = resolve("E:/code/biz-glance/tmp/repo-context-script-tests");
const scriptPath = resolve("E:/code/biz-glance/skills/bizglance/scripts/collect-repo-context.mjs");

async function resetRepo(name: string) {
  const repo = resolve(tmpRoot, name);
  await rm(repo, { recursive: true, force: true });
  await mkdir(resolve(repo, "src/orders"), { recursive: true });
  await writeFile(resolve(repo, "README.md"), "# Shop API\n\nHandles order and payment workflows.\n", "utf8");
  await writeFile(
    resolve(repo, "package.json"),
    JSON.stringify({ name: "shop-api", dependencies: { express: "^5.0.0" } }, null, 2),
    "utf8"
  );
  await writeFile(
    resolve(repo, "src/orders/OrderController.ts"),
    [
      "export class OrderController {",
      "  async submitOrder() {",
      "    return '/api/orders';",
      "  }",
      "}"
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    resolve(repo, "src/orders/Order.ts"),
    [
      "export interface Order {",
      "  id: string;",
      "  status: 'draft' | 'paid';",
      "  totalAmount: number;",
      "}"
    ].join("\n"),
    "utf8"
  );

  return repo;
}

describe("collect-repo-context script", () => {
  it("collects stable repository facts and business candidates", async () => {
    const repo = await resetRepo("shop-api");
    const output = resolve(repo, ".bizglance/intermediate/repo-context.json");
    const { collectRepoContext } = await import(pathToFileURL(scriptPath).href);

    await collectRepoContext({
      repo,
      output
    });

    const context = JSON.parse(await readFile(output, "utf8")) as {
      repo: { name: string; root: string };
      readme?: { path: string; summary: string };
      manifests: Array<{ path: string; name?: string; dependencies?: string[] }>;
      entrypoints: Array<{ filePath: string; kind: string; symbol?: string }>;
      entityCandidates: Array<{ filePath: string; technicalName: string }>;
      statusCandidates: Array<{ filePath: string; field: string }>;
      fieldCandidates: Array<{ filePath: string; field: string }>;
    };

    expect(context.repo.name).toBe("shop-api");
    expect(context.repo.root.replace(/\\/g, "/")).toBe(repo.replace(/\\/g, "/"));
    expect(context.readme?.summary).toContain("Handles order");
    expect(context.manifests[0]).toMatchObject({
      path: "package.json",
      name: "shop-api"
    });
    expect(context.manifests[0].dependencies).toContain("express");
    expect(context.entrypoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "src/orders/OrderController.ts",
          kind: "controller",
          symbol: "OrderController"
        })
      ])
    );
    expect(context.entityCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "src/orders/Order.ts",
          technicalName: "Order"
        })
      ])
    );
    expect(context.statusCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "src/orders/Order.ts",
          field: "status"
        })
      ])
    );
    expect(context.fieldCandidates.map((item) => item.field)).toContain("totalAmount");
  });

  it("can be executed from the command line", async () => {
    expect(fileURLToPath(pathToFileURL(scriptPath))).toBe(scriptPath);
  });
});
