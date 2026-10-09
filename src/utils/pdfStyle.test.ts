import { describe, it, expect } from "vitest";
import { resolvePdfStyle } from "./pdfStyle";

describe("PDF style", () => {
  it("follows the youngest age group in auto, and the choice otherwise", () => {
    expect(resolvePdfStyle("auto", ["4-6"])).toBe("kids");
    expect(resolvePdfStyle("auto", ["13-15", "2-3"])).toBe("kids");
    expect(resolvePdfStyle("auto", ["10-12"])).toBe("teen");
    expect(resolvePdfStyle("auto", [])).toBe("teen");
    expect(resolvePdfStyle("pro", ["4-6"])).toBe("pro");
  });
});
