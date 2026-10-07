import { describe, it, expect } from "vitest";
import { parseStorySegment, splitStorySegments } from "./storyParser";
import { mapFrToEnDay } from "./dayUtils";

const story = (overrides: { header?: string; body?: string } = {}) =>
  `${overrides.header ?? `**Titre de l'Histoire :** La pluie de Léo
**Thème Hebdomadaire :** La pluie
**Tranche d'Âge :** 4-6
**Jour de la Semaine :** Lundi
**Thèmes Associés (JSON):** [{"name": "Nature", "description": "Le monde naturel", "icon": "🌿", "color": "#4CAF50"}]`}

${overrides.body ?? `Léo regarde le ciel. Le thème du jour, c'est la pluie qui tombe.
Il voit une série de nuages gris arriver doucement.
[Illustration: Léo sous un parapluie jaune, nuages gris.]
Sa maman lui fait une description des gouttes qui dansent.
[Illustration: Gouttes de pluie qui dansent sur une flaque.]
Que va-t-il se passer demain ?`}`;

describe("parseStorySegment", () => {
  it("keeps story sentences that contain metadata words", () => {
    const parsed = parseStorySegment(story());

    expect(parsed.content).toContain("Le thème du jour, c'est la pluie qui tombe.");
    expect(parsed.content).toContain("Il voit une série de nuages gris arriver doucement.");
    expect(parsed.content).toContain("Sa maman lui fait une description des gouttes qui dansent.");
    expect(parsed.content).toContain("Que va-t-il se passer demain ?");
  });

  it("extracts metadata and strips the header lines", () => {
    const parsed = parseStorySegment(story());

    expect(parsed.title).toBe("La pluie de Léo");
    expect(parsed.dayOfWeek).toBe("Lundi");
    expect(parsed.associatedThemes).toEqual([
      { name: "Nature", description: "Le monde naturel", icon: "🌿", color: "#4CAF50" },
    ]);
    expect(parsed.content).not.toMatch(/Titre de l'Histoire|Thème Hebdomadaire|Tranche d'Âge|Jour de la Semaine|"name"/);
  });

  it("removes and collects every illustration description", () => {
    const parsed = parseStorySegment(story());

    expect(parsed.content).not.toContain("[Illustration");
    expect(parsed.illustrationDescription).toContain("Léo sous un parapluie jaune");
    expect(parsed.illustrationDescription).toContain("Gouttes de pluie qui dansent");
  });

  it("collects labelled illustration lines", () => {
    const parsed = parseStorySegment(story({ body: "Il pleut.\n> **Illustration suggérée :** Un escargot sur une feuille.\nFin." }));

    expect(parsed.content).toBe("Il pleut.\nFin.");
    expect(parsed.illustrationDescription).toBe("Un escargot sur une feuille.");
  });

  it.each([
    ["**Jour de la Semaine:** lundi", "lundi"],
    ["Jour de la Semaine : Mardi.", "Mardi"],
    ["**Jour de la Semaine :** **Mercredi**", "Mercredi"],
  ])("reads the day from %s", (dayLine, expected) => {
    const parsed = parseStorySegment(story({ header: `**Titre :** Une histoire\n${dayLine}` }));

    expect(parsed.dayOfWeek).toBe(expected);
    expect(parsed.content).not.toContain("Jour de la Semaine");
  });

  it("does not take a sentence mentioning a title as the title", () => {
    const parsed = parseStorySegment("Le Grand Voyage\nLe titre du livre était inscrit en or.");

    expect(parsed.title).toBe("Le Grand Voyage");
    expect(parsed.content).toContain("Le titre du livre était inscrit en or.");
  });
});

describe("splitStorySegments", () => {
  it("returns the raw text for a single story", () => {
    expect(splitStorySegments("texte", false)).toEqual(["texte"]);
  });

  it("splits a weekly answer on title lines only", () => {
    const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    const raw = "Voici les histoires de la semaine :\n\n" + days
      .map(day => `**Titre de l'Histoire :** Histoire du ${day}\n**Jour de la Semaine :** ${day}\n\nLe titre de ce chapitre est secret.`)
      .join("\n\n");

    const parsed = splitStorySegments(raw, true).map(parseStorySegment).filter(s => s.dayOfWeek);

    expect(parsed.map(s => s.dayOfWeek)).toEqual(days);
    expect(parsed[0].title).toBe("Histoire du Lundi");
    expect(parsed[0].content).toBe("Le titre de ce chapitre est secret.");
  });
});

describe("mapFrToEnDay", () => {
  it.each([
    ["Lundi", "Monday"],
    ["lundi", "Monday"],
    ["Mardi.", "Tuesday"],
    ["**Mercredi**", "Wednesday"],
    ["Toute la semaine", "Monday"],
    ["Friday", "Friday"],
  ])("maps %s to %s", (input, expected) => {
    expect(mapFrToEnDay(input)).toBe(expected);
  });

  it("returns unknown values unchanged", () => {
    expect(mapFrToEnDay("Bientôt")).toBe("Bientôt");
  });
});
