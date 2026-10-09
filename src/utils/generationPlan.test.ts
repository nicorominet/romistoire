import { describe, it, expect } from "vitest";
import { ALL_WEEK } from "@/constants";
import {
  buildDayParams, countWords, emptyWeekContext, GENERATION_MIN_INTERVAL_MS, isIterativeGeneration, isShortStory, missingWeekStories, pacingDelay, storyEnding, storyOpening,
} from "./generationPlan";

describe("generation plan", () => {
  it("generates a week in one request for young ages, day by day from 10-12 or with Ollama", () => {
    expect(isIterativeGeneration(ALL_WEEK, "4-6", "gemini")).toBe(false);
    expect(isIterativeGeneration(ALL_WEEK, "7-9 ans", "gemini")).toBe(false);
    expect(isIterativeGeneration(ALL_WEEK, "10-12", "gemini")).toBe(true);
    expect(isIterativeGeneration(ALL_WEEK, "16-18", "gemini")).toBe(true);
    expect(isIterativeGeneration(ALL_WEEK, "4-6", "local")).toBe(true);
    expect(isIterativeGeneration("Lundi", "16-18", "gemini")).toBe(false);
  });

  it("spaces cloud requests by the minimal interval, counted from the previous start", () => {
    expect(pacingDelay(null, 5000)).toBe(0);
    expect(pacingDelay(1000, 4000)).toBe(GENERATION_MIN_INTERVAL_MS - 3000);
    // A request that lasted longer than the interval costs no wait
    expect(pacingDelay(1000, 1000 + 60000)).toBe(0);
  });

  it("counts words without HTML and flags stories under half of the minimum", () => {
    expect(countWords("<p>Il était</p><p>une fois</p>")).toBe(4);
    expect(isShortStory(300, { min: 900, max: 1100 })).toBe(true);
    expect(isShortStory(600, { min: 900, max: 1100 })).toBe(false);
    expect(isShortStory(10, undefined)).toBe(false);
  });
});

describe("week context", () => {
  it("takes the last paragraph of a story as plain text", () => {
    expect(storyEnding("<p>Début.</p><p>Il pose le pied sur la planche &amp; elle craque !</p>"))
      .toBe("Il pose le pied sur la planche & elle craque !");
    expect(storyEnding("Premier.\n\nDernier.")).toBe("Dernier.");
    expect(storyEnding(`<p>${"a".repeat(1000)}</p>`, 10)).toBe(`…${"a".repeat(10)}`);
  });

  it("asks Monday for the plan, then gives each day the plan, the days told and the last scene", () => {
    const context = emptyWeekContext();
    expect(buildDayParams(context)).toEqual({
      weekSeries: true, weekPlan: undefined, previousDays: [], previousEnding: undefined, previousSummary: undefined,
    });

    context.weekPlan = ["1", "2", "3", "4", "5", "6", "7"];
    context.characters = [{ name: "Papouin", description: "Garçon de 5 ans" }];
    context.days.push({ day: "Lundi", title: "La carte", summary: "Léo trouve une carte.", ending: "Elle brille !", opening: "Léo court sur la plage." });
    context.days.push({ day: "Mardi", title: "Le lac", summary: "Le pont est cassé.", ending: "La planche craque !" });

    expect(buildDayParams(context)).toEqual({
      weekSeries: true,
      weekPlan: ["1", "2", "3", "4", "5", "6", "7"],
      characters: [{ name: "Papouin", description: "Garçon de 5 ans" }],
      previousDays: [
        { day: "Lundi", title: "La carte", summary: "Léo trouve une carte.", opening: "Léo court sur la plage." },
        { day: "Mardi", title: "Le lac", summary: "Le pont est cassé." },
      ],
      previousEnding: "La planche craque !",
      previousSummary: "Le pont est cassé.",
    });
  });
});

describe("story opening", () => {
  it("takes the first sentence of a story, cut when too long", () => {
    expect(storyOpening("<p>Alors que la neige tombait, Claudine sourit. Puis elle sortit.</p><p>Suite.</p>"))
      .toBe("Alors que la neige tombait, Claudine sourit.");
    expect(storyOpening("<p>« Regarde ! » cria Léo en courant.</p>")).toBe("« Regarde ! » cria Léo en courant.");
    expect(storyOpening(`<p>${"a".repeat(300)}</p>`, 20)).toBe(`${"a".repeat(20)}…`);
    expect(storyOpening("")).toBe("");
  });
});

describe("incomplete week", () => {
  it("counts the stories missing from a week generated in one request", () => {
    expect(missingWeekStories(ALL_WEEK, 1)).toBe(6);
    expect(missingWeekStories(ALL_WEEK, 7)).toBe(0);
    expect(missingWeekStories("Lundi", 1)).toBe(0);
  });
});
