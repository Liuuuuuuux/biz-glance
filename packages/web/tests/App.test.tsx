// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";
import sample from "../../../examples/education.bizglance.json";
import shopSample from "../../../examples/shop-sample.bizglance.json";
import type { BizGlanceDocument } from "../../core/src/index";

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("renders the first business object and document flow", () => {
    render(<App initialDocument={sample as BizGlanceDocument} />);

    expect(screen.getAllByText("课程").length).toBeGreaterThan(0);
    expect(screen.getByText("单据流转")).toBeTruthy();
  });

  it("filters business objects by search and module", async () => {
    const user = userEvent.setup();
    render(<App initialDocument={sample as BizGlanceDocument} />);

    const searchInput = screen.getByPlaceholderText("搜索业务对象");
    await user.type(searchInput, "报名");

    expect(screen.getByRole("button", { name: /报名记录/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /课程/i })).toBeNull();

    await user.clear(searchInput);
    await user.selectOptions(screen.getByLabelText("模块筛选"), "learning");

    expect(screen.getByRole("button", { name: /学习进度/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /学习证书/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /报名记录/i })).toBeNull();
  });

  it("opens the import dialog from the workbench entry", async () => {
    const user = userEvent.setup();
    render(<App initialDocument={sample as BizGlanceDocument} />);

    await user.click(screen.getByRole("button", { name: "导入项目" }));

    expect(screen.getByRole("dialog", { name: "导入项目" })).toBeTruthy();
    expect(screen.getByText("填写代码库路径和分析范围，BizGlance 会生成业务图谱数据。")).toBeTruthy();
  });

  it("updates the view heading when switching tabs", async () => {
    const user = userEvent.setup();
    render(<App initialDocument={sample as BizGlanceDocument} />);

    expect(screen.getByRole("heading", { name: "课程到报名记录" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "状态流转" }));

    expect(screen.getByRole("heading", { name: "状态从入口到持久化" })).toBeTruthy();
    expect(screen.getByText("Status Flow")).toBeTruthy();
  });

  it("shows code evidence paths for real repository analysis results", () => {
    const document: BizGlanceDocument = {
      ...(sample as BizGlanceDocument),
      evidences: [
        {
          id: "repo-object-purchase-order",
          title: "PurchaseOrder domain",
          filePath: "src/main/java/com/example/demo/domain/PurchaseOrder.java",
          route: "/purchase-orders",
          lines: {
            start: 1,
            end: 24
          },
          symbol: "PurchaseOrder",
          summary: "识别到 PurchaseOrder 领域对象"
        }
      ],
      flows: [
        {
          id: "repo-flow-purchase-order",
          from: "course",
          to: "enrollment",
          relation: "creates",
          label: "识别真实项目流转",
          sourceKind: "inferred",
          confidence: "medium",
          evidenceIds: ["repo-object-purchase-order"]
        }
      ]
    };

    render(<App initialDocument={document} />);

    expect(screen.getByText("src/main/java/com/example/demo/domain/PurchaseOrder.java")).toBeTruthy();
    expect(screen.getByText("Route: /purchase-orders")).toBeTruthy();
    expect(screen.getByText("Lines: 1-24")).toBeTruthy();
  });

  it("renders a local shop CodeGraph analysis result as business workbench data", async () => {
    const user = userEvent.setup();
    render(<App initialDocument={shopSample as BizGlanceDocument} />);

    expect(screen.getByRole("button", { name: /Product/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /User/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Product/i }));

    expect(screen.getByText("更新Product")).toBeTruthy();
    expect(screen.getByText("src/main/java/com/syqu/shop/controller/ProductController.java")).toBeTruthy();
    expect(screen.getByText((text) => text.includes("/product/edit/{id}"))).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /User/i }));

    expect(screen.getByText("创建User")).toBeTruthy();
    expect(screen.getByText((text) => text.includes("/register"))).toBeTruthy();
  });
});
