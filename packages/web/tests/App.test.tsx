// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";
import sample from "../../../examples/education.bizglance.json";
import type { BizGlanceDocument } from "../../core/src/index";

describe("App", () => {
  it("renders the first business object and document flow", () => {
    render(<App initialDocument={sample as BizGlanceDocument} />);

    expect(screen.getAllByText("课程").length).toBeGreaterThan(0);
    expect(screen.getByText("单据流转")).toBeTruthy();
  });
});
