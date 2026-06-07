import { describe, expect, it } from "vitest";
import { resolveServeDataPath, buildWebDataUrl } from "../src/commands/serve";

describe("buildWebDataUrl", () => {
  it("uses the fixed preview port and adds the JSON path as a data query parameter", () => {
    const url = buildWebDataUrl("/current.bizglance.json");

    expect(url.startsWith("http://localhost:4173/")).toBe(true);
    expect(url).toContain("data=");
  });

  it("defaults to the generated BizGlance document", () => {
    const previousInitCwd = process.env.INIT_CWD;
    process.env.INIT_CWD = "E:/code/biz-glance";

    try {
      expect(resolveServeDataPath(undefined)).toBe("E:\\code\\biz-glance\\dist\\bizglance.json");
    } finally {
      process.env.INIT_CWD = previousInitCwd;
    }
  });
});
