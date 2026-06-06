import { describe, expect, it } from "vitest";
import { getSampleDocument } from "../src/index";

describe("sample document", () => {
  it("returns the education sample with flows and evidence", () => {
    const doc = getSampleDocument("education");

    expect(doc.meta.source.kind).toBe("sample");
    expect(doc.businessObjects.length).toBeGreaterThan(2);
    expect(doc.flows.some((flow) => flow.relation === "creates")).toBe(true);
    expect(doc.evidences.length).toBeGreaterThan(0);
  });
});
