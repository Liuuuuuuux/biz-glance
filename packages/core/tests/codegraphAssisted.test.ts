import { describe, expect, it } from "vitest";
import { analyzeCodeGraphContext } from "../src/analyzers/codegraphAssisted";

describe("analyzeCodeGraphContext", () => {
  it("turns CodeGraph context and LLM findings into a BizGlance document", () => {
    const doc = analyzeCodeGraphContext({
      source: {
        name: "shop",
        path: "E:/code/shop"
      },
      codegraph: {
        query: "Analyze business objects and code evidence",
        summary: "Found controller, service, and entity symbols.",
        nodes: [
          {
            kind: "class",
            name: "Product",
            qualifiedName: "com.example.shop.domain.Product",
            filePath: "src/main/java/com/example/shop/domain/Product.java",
            language: "java",
            startLine: 8,
            endLine: 42
          },
          {
            kind: "method",
            name: "createProduct",
            qualifiedName: "com.example.shop.controller.ProductController.createProduct",
            filePath: "src/main/java/com/example/shop/controller/ProductController.java",
            language: "java",
            startLine: 21,
            endLine: 28
          }
        ],
        edges: [
          {
            source: "com.example.shop.controller.ProductController.createProduct",
            target: "com.example.shop.domain.Product",
            kind: "uses"
          }
        ],
        codeBlocks: [
          {
            filePath: "src/main/java/com/example/shop/controller/ProductController.java",
            startLine: 21,
            endLine: 28,
            language: "java",
            content: "@PostMapping(\"/product\")\npublic Product createProduct(Product product) {\n  return productService.save(product);\n}",
            nodeName: "createProduct",
            nodeKind: "method"
          }
        ],
        relatedFiles: ["src/main/java/com/example/shop/controller/ProductController.java"],
        stats: {
          nodeCount: 2,
          edgeCount: 1,
          fileCount: 2,
          codeBlockCount: 1,
          totalCodeSize: 132
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
        flows: [
          {
            from: "Product",
            to: "Product",
            relation: "creates",
            label: "创建商品",
            confidence: "high",
            evidence: {
              nodeName: "createProduct",
              route: "/product",
              summary: "LLM 基于 CodeGraph controller 方法判断该接口创建商品"
            }
          }
        ],
        statusMutations: [],
        fieldLineages: []
      }
    });

    expect(doc.meta.source.kind).toBe("repo");
    expect(doc.meta.source.lens).toBe("codegraph-assisted");
    expect(doc.meta.source.name).toBe("shop");
    expect(doc.meta.source.path).toBe("E:/code/shop");
    expect(doc.businessObjects).toEqual([
      {
        id: "product",
        name: "商品",
        technicalName: "Product",
        module: "catalog"
      }
    ]);
    expect(doc.flows[0]).toMatchObject({
      from: "product",
      to: "product",
      relation: "creates",
      label: "创建商品",
      confidence: "high"
    });
    expect(doc.evidences.find((item) => item.symbol === "createProduct")).toMatchObject({
      route: "/product",
      filePath: "src/main/java/com/example/shop/controller/ProductController.java",
      lines: {
        start: 21,
        end: 28
      }
    });
  });

  it("uses explicit evidence location when CodeGraph has overloaded or duplicated node names", () => {
    const doc = analyzeCodeGraphContext({
      source: {
        name: "example/shop"
      },
      codegraph: {
        nodes: [
          {
            kind: "method",
            name: "newProduct",
            filePath: "src/main/java/com/example/shop/controller/ProductController.java",
            startLine: 32,
            endLine: 38
          },
          {
            kind: "method",
            name: "newProduct",
            filePath: "src/main/java/com/example/shop/controller/ProductController.java",
            startLine: 40,
            endLine: 53
          }
        ],
        codeBlocks: []
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
            evidence: {
              nodeName: "newProduct",
              route: "/product/new",
              filePath: "src/main/java/com/example/shop/controller/ProductController.java",
              startLine: 40,
              endLine: 53,
              summary: "POST /product/new 调用商品保存逻辑"
            }
          }
        ]
      }
    });

    expect(doc.evidences.find((item) => item.id === "codegraph-flow-1")).toMatchObject({
      symbol: "newProduct",
      filePath: "src/main/java/com/example/shop/controller/ProductController.java",
      lines: {
        start: 40,
        end: 53
      }
    });
  });
});
