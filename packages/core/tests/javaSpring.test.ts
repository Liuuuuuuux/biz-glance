import { describe, expect, it } from "vitest";
import { analyzeJavaSpringProject } from "../src/analyzers/javaSpring";

const fixtureRoot = "E:/code/biz-glance/fixtures/java-spring-cases";

function fixture(name: string) {
  return `${fixtureRoot}/${name}`;
}

describe("analyzeJavaSpringProject", () => {
  it("extracts a minimal status mutation and business object relation", async () => {
    const doc = await analyzeJavaSpringProject("E:/code/biz-glance/fixtures/java-spring-mini");
    const relation = doc.flows.find(
      (item) => item.from === "purchase-order" && item.to === "receipt-order"
    );

    expect(doc.meta.source.kind).toBe("repo");
    expect(doc.businessObjects.some((item) => item.name.includes("采购订单"))).toBe(true);
    expect(doc.businessObjects.some((item) => item.technicalName === "ReceiptOrder")).toBe(true);
    expect(doc.flows.length).toBeGreaterThan(0);
    expect(relation?.relation).toBe("creates");
    expect(doc.statusMutations.some((item) => item.field === "status")).toBe(true);
    expect(doc.statusMutations).toHaveLength(1);
  });

  it("derives business object identity from arbitrary domain class names", async () => {
    const doc = await analyzeJavaSpringProject(fixture("sales-status"));

    expect(doc.meta.source.name).toBe("sales-status");
    expect(doc.businessObjects.some((item) => item.technicalName === "SalesOrder")).toBe(true);
    expect(doc.statusMutations.some((item) => item.objectId === "sales-order")).toBe(true);
  });

  it("infers creates flow between different business objects from service logic", async () => {
    const doc = await analyzeJavaSpringProject(fixture("create-flow"));
    const relation = doc.flows.find(
      (item) => item.from === "purchase-order" && item.to === "receipt-order"
    );

    expect(relation?.relation).toBe("creates");
  });

  it("keeps create flow scoped to the method that actually creates the target object", async () => {
    const doc = await analyzeJavaSpringProject(fixture("method-scope"));
    const relation = doc.flows.find((item) => item.to === "receipt-order");

    expect(relation?.from).toBe("purchase-order");
    expect(relation?.relation).toBe("creates");
  });

  it("infers references flow when one object writes fields from another without creating it", async () => {
    const doc = await analyzeJavaSpringProject(fixture("reference-flow"));
    const relation = doc.flows.find(
      (item) => item.from === "purchase-order" && item.to === "receipt-order"
    );

    expect(relation?.relation).toBe("references");
  });

  it("extracts field lineage from setter and getter calls", async () => {
    const doc = await analyzeJavaSpringProject("E:/code/biz-glance/fixtures/java-spring-mini");
    const lineage = doc.fieldLineages.find(
      (item) => item.objectId === "receipt-order" && item.targetField === "sourceStatus"
    );

    expect(lineage?.sourceFields).toEqual(["purchase-order.status"]);
    expect(lineage?.expression).toBe("order.getStatus()");
    expect(lineage?.evidenceIds).toEqual(["repo-lineage-receipt-order-source-status"]);
    expect(
      doc.evidences.find((item) => item.id === "repo-lineage-receipt-order-source-status")?.summary
    ).toBe("识别到 ReceiptOrder.sourceStatus 来源于 PurchaseOrder.status");
  });

  it("prefers entity classes as business objects while still extracting lineage from dto inputs", async () => {
    const doc = await analyzeJavaSpringProject(fixture("entity-filter"));
    const lineage = doc.fieldLineages.find(
      (item) => item.objectId === "user" && item.targetField === "userAccount"
    );

    expect(doc.meta.source.name).toBe("entity-filter");
    expect(doc.businessObjects.map((item) => item.technicalName)).toEqual(["User"]);
    expect(doc.businessObjects.some((item) => item.technicalName === "UserEntityTests")).toBe(false);
    expect(lineage?.sourceFields).toEqual(["register-dto.username"]);
  });

  it("infers self create flow from controller route into service persistence", async () => {
    const doc = await analyzeJavaSpringProject(fixture("route-create"));
    const relation = doc.flows.find(
      (item) => item.from === "user" && item.to === "user" && item.relation === "creates"
    );
    const routeEvidence = relation
      ? doc.evidences.find(
          (item) => relation.evidenceIds.includes(item.id) && item.route === "/auth/register"
        )
      : undefined;

    expect(relation?.label).toBe("创建User");
    expect(routeEvidence?.summary).toContain("AuthController.register");
  });

  it("infers self update flow from controller route into service update logic", async () => {
    const doc = await analyzeJavaSpringProject(fixture("route-update"));
    const relation = doc.flows.find(
      (item) => item.from === "user" && item.to === "user" && item.relation === "updates"
    );
    const routeEvidence = relation
      ? doc.evidences.find(
          (item) => relation.evidenceIds.includes(item.id) && item.route === "/user/{id}/status"
        )
      : undefined;

    expect(relation?.label).toBe("更新User");
    expect(routeEvidence?.summary).toContain("UserController.updateStatus");
  });

  it("infers self create flow when a registration route saves an input business object", async () => {
    const doc = await analyzeJavaSpringProject(fixture("route-save-param"));
    const relation = doc.flows.find(
      (item) => item.from === "user" && item.to === "user" && item.relation === "creates"
    );
    const routeEvidence = relation
      ? doc.evidences.find(
          (item) => relation.evidenceIds.includes(item.id) && item.route === "/register"
        )
      : undefined;

    expect(relation?.label).toBe("创建User");
    expect(routeEvidence?.summary).toContain("RegisterController.registration");
  });
});
