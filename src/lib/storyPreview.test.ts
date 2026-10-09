import { describe, it, expect } from "vitest";
import { storyPlainText, storyPreview } from "./utils";

describe("story preview", () => {
  it("shows the text of a generated story stored as editor HTML", () => {
    expect(storyPlainText("<p>Au bord de la rivière, Marouin s&#39;agenouilla.</p><p>Il tenait une branche &amp; riait.</p>"))
      .toBe("Au bord de la rivière, Marouin s'agenouilla. Il tenait une branche & riait.");
  });

  it("keeps older plain-text and markdown stories readable", () => {
    expect(storyPlainText("**Titre**\n\nLéa marche.\n[Illustration: une fille en ciré]\nFin.")).toBe("Titre Léa marche. Fin.");
    expect(storyPlainText(null)).toBe("");
  });

  it("never interprets markup", () => {
    expect(storyPlainText('<img src=x onerror="alert(1)">Bonjour')).toBe("Bonjour");
  });

  it("cuts the preview", () => {
    expect(storyPreview("<p>Une histoire assez longue pour être coupée.</p>", 10)).toBe("Une histoi...");
  });
});
