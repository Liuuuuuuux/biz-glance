import { describe, expect, it } from "vitest";
import {
  validateBizGlanceDocument,
  validateBizGlanceEvidenceReferences,
  validateCompleteBizGlanceDocument,
  validateCodeGraphAssistedAnalysisInput,
  type BizGlanceDocument
} from "../src/index";

const validContext = {
  codegraph: {
    nodes: [],
    edges: [],
    codeBlocks: [],
    relatedFiles: []
  },
  findings: {
    businessObjects: [
      {
        technicalName: "Product",
        name: "商品"
      }
    ],
    flows: [
      {
        from: "Product",
        to: "Product",
        relation: "creates",
        label: "创建商品",
        confidence: "high"
      }
    ],
    statusMutations: [],
    fieldLineages: []
  }
};

const validDocument: BizGlanceDocument = {
  meta: {
    version: "0.1.0",
    generatedAt: "2026-06-07T00:00:00.000Z",
    source: {
      kind: "repo",
      name: "shop",
      lens: "codegraph-assisted",
      path: "E:/code/shop"
    },
    warnings: []
  },
  businessObjects: [
    {
      id: "product",
      name: "商品",
      technicalName: "Product"
    }
  ],
  flows: [
    {
      id: "flow-1",
      from: "product",
      to: "product",
      relation: "creates",
      label: "创建商品",
      sourceKind: "inferred",
      confidence: "high",
      evidenceIds: ["evidence-1"]
    }
  ],
  statusMutations: [],
  fieldLineages: [],
  evidences: [
    {
      id: "evidence-1",
      title: "创建商品",
      summary: "POST /products 创建商品"
    }
  ]
};

describe("runtime validation", () => {
  it("accepts a valid CodeGraph-assisted analysis input without source", () => {
    const result = validateCodeGraphAssistedAnalysisInput(validContext);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects context findings without business object technical names", () => {
    const result = validateCodeGraphAssistedAnalysisInput({
      ...validContext,
      findings: {
        businessObjects: [{ name: "商品" }]
      }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("findings.businessObjects[0].technicalName 必须是字符串。");
  });

  it("rejects unsupported flow relations", () => {
    const result = validateCodeGraphAssistedAnalysisInput({
      ...validContext,
      findings: {
        ...validContext.findings,
        flows: [
          {
            from: "Product",
            to: "Order",
            relation: "deletes",
            label: "删除商品"
          }
        ]
      }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "findings.flows[0].relation 必须是 creates、updates 或 references。"
    );
  });

  it("accepts a valid BizGlance document", () => {
    const result = validateBizGlanceDocument(validDocument);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a BizGlance document with missing arrays", () => {
    const result = validateBizGlanceDocument({
      meta: validDocument.meta,
      businessObjects: validDocument.businessObjects
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("flows 必须是数组。");
    expect(result.errors).toContain("evidences 必须是数组。");
  });

  it("reports missing evidence references as validation errors", () => {
    const result = validateBizGlanceEvidenceReferences({
      ...validDocument,
      flows: [
        {
          ...validDocument.flows[0],
          evidenceIds: ["missing-evidence"]
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("flows[0].evidenceIds[0] 引用不存在的 evidence: missing-evidence。");
  });

  it("rejects malformed document evidenceIds without crashing", () => {
    const result = validateCompleteBizGlanceDocument({
      ...validDocument,
      flows: [
        {
          ...validDocument.flows[0],
          evidenceIds: undefined
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("flows[0].evidenceIds 必须是字符串数组。");
  });
});
