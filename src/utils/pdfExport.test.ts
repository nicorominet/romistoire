import { beforeEach, describe, expect, it, vi } from "vitest";
import { storyApi } from "@/api/stories.api";
import { Story } from "@/types/Story";
import { fetchAllPdfStories, filterPdfStories } from "./pdfExport";

vi.mock("@/api/stories.api", () => ({
  storyApi: { getAll: vi.fn() },
}));

const makeStory = (id: string, day_order: number, overrides: Partial<Story> = {}): Story => ({
  id,
  title: `Story ${id}`,
  content: "Text",
  themes: [{ id: "theme-nature", name: "Nature", description: "", color: "#00aa00", icon: null, created_at: "", storyCount: 1 }],
  age_group: "4-6",
  week_number: 1,
  day_order,
  created_at: "2026-10-09T12:00:00.000Z",
  modified_at: "2026-10-09T12:00:00.000Z",
  version: 1,
  locale: "fr",
  source: "manual",
  is_manually_edited: false,
  illustrations: [],
  ...overrides,
});

describe("PDF export stories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads every page with the library filters, including stories from every weekday", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => makeStory(`story-${index}`, (index % 7) + 1));
    const lastPage = [makeStory("story-100", 7)];
    vi.mocked(storyApi.getAll)
      .mockResolvedValueOnce({ data: firstPage, total: 101, page: 1, limit: 100 })
      .mockResolvedValueOnce({ data: lastPage, total: 101, page: 2, limit: 100 });

    const stories = await fetchAllPdfStories({ search: "forest", ageGroup: "4-6" });

    expect(stories).toHaveLength(101);
    expect(new Set(stories.map((story) => story.day_order))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    expect(storyApi.getAll).toHaveBeenNthCalledWith(1, { search: "forest", ageGroup: "4-6", page: 1, limit: 100 });
    expect(storyApi.getAll).toHaveBeenNthCalledWith(2, { search: "forest", ageGroup: "4-6", page: 2, limit: 100 });
  });

  it("combines theme, age, inclusive date and selected-week filters", () => {
    const stories = [
      makeStory("match", 1, { created_at: "2026-10-09T23:59:59.000Z" }),
      makeStory("wrong-week", 1, { week_number: 2 }),
      makeStory("wrong-theme", 1, { themes: [] }),
      makeStory("wrong-age", 1, { age_group: "7-9" }),
      makeStory("after-date", 1, { created_at: "2026-10-10T00:00:00.000Z" }),
    ];

    expect(filterPdfStories(stories, {
      themeId: "theme-nature",
      ageGroup: "4-6",
      dateFrom: "2026-10-09",
      dateTo: "2026-10-09",
      weeks: [1],
    }).map((story) => story.id)).toEqual(["match"]);
  });

  it("returns no stories if no weeks are selected", () => {
    expect(filterPdfStories([makeStory("story", 1)], {
      themeId: "default",
      ageGroup: "default",
      dateFrom: "",
      dateTo: "",
      weeks: [],
    })).toEqual([]);
  });
});
