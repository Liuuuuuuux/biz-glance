// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";
import sample from "../../../examples/education.bizglance.json";
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
});
