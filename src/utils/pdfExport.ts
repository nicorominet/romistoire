import { storyApi } from "@/api/stories.api";
import { PaginatedResponse } from "@/types/Api";
import { PaginationParams, Story } from "@/types/Story";

const PDF_STORIES_PAGE_SIZE = 100;

type StoryQuery = Omit<Partial<PaginationParams>, "page" | "limit">;

export interface PdfStoryFilters {
  themeId: string;
  ageGroup: string;
  dateFrom: string;
  dateTo: string;
  weeks: number[];
}

/** Fetch every page matching the library filters so PDF export is not limited to the visible list page. */
export async function fetchAllPdfStories(query: StoryQuery): Promise<Story[]> {
  const firstPage = await storyApi.getAll({
    ...query,
    page: 1,
    limit: PDF_STORIES_PAGE_SIZE,
  } as PaginationParams);
  const stories = [...firstPage.data];

  for (let page = 2; stories.length < firstPage.total; page++) {
    const response: PaginatedResponse<Story> = await storyApi.getAll({
      ...query,
      page,
      limit: PDF_STORIES_PAGE_SIZE,
    } as PaginationParams);

    if (response.data.length === 0) {
      throw new Error(`PDF story loading stopped before all ${firstPage.total} stories were retrieved.`);
    }

    stories.push(...response.data);
  }

  return stories.slice(0, firstPage.total);
}

/** Apply the PDF-only filters to the complete set of stories returned by the library query. */
export function filterPdfStories(stories: Story[], filters: PdfStoryFilters): Story[] {
  return stories.filter((story) => {
    if (filters.themeId && filters.themeId !== "default"
      && !story.themes?.some((theme) => theme.id === filters.themeId)) return false;

    if (filters.ageGroup && filters.ageGroup !== "default" && story.age_group !== filters.ageGroup) return false;

    if (filters.weeks.length === 0 || !filters.weeks.includes(story.week_number)) return false;

    if (filters.dateFrom || filters.dateTo) {
      const createdDate = story.created_at.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(createdDate)) return false;
      if (filters.dateFrom && createdDate < filters.dateFrom) return false;
      if (filters.dateTo && createdDate > filters.dateTo) return false;
    }

    return true;
  });
}
