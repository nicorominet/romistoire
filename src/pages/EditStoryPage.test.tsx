import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditStoryPage from "./EditStoryPage";
import { i18n } from "@/lib/i18n";
import { Story } from "@/types/Story";

const { mockStory, mockGetVersions } = vi.hoisted(() => ({
  mockStory: { current: null as Story | null },
  mockGetVersions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/useStoryData", () => ({
  default: () => ({
    story: mockStory.current,
    loading: false,
    error: null,
    illustrations: [],
    weeklyThemes: [],
    addIllustrationToBackend: vi.fn(),
    deleteIllustration: vi.fn(),
    reorderIllustrations: vi.fn(),
  }),
}));

vi.mock("@/hooks/useThemes", () => ({
  useThemes: () => ({ data: [] }),
  useThemeMutations: () => ({ createTheme: { mutateAsync: vi.fn() } }),
}));

vi.mock("@/hooks/useSeries", () => ({
  useSeries: () => ({ data: [] }),
}));

vi.mock("@/api/stories.api", () => ({
  storyApi: { getVersions: mockGetVersions, getAll: vi.fn().mockResolvedValue({ data: [], total: 0 }) },
}));

vi.mock("@/components/Story/StoryEditor/StoryContent", () => ({
  default: () => <div />,
}));

vi.mock("@/components/Story/StoryEditor/StoryIllustrations", () => ({
  default: () => <div />,
}));

describe("EditStoryPage", () => {
  beforeEach(() => {
    mockStory.current = {
      id: "ai-story",
      title: "AI story",
      content: "<p>Story body</p>",
      themes: [{ id: "theme-1", name: "Adventure", description: "", color: "#000000", created_at: "" }],
      age_group: "4-6",
      week_number: 40,
      day_order: 1,
      created_at: "2026-10-05T10:00:00.000Z",
      modified_at: "2026-10-05T10:00:00.000Z",
      version: 1,
      locale: "fr",
      source: "gemini",
      is_manually_edited: false,
      illustrations: [],
    };
    mockGetVersions.mockResolvedValue([]);
  });

  const renderPage = () => {
    const queryClient = new QueryClient();
    const router = createMemoryRouter(
      [{ path: "/stories/:id/edit", element: <EditStoryPage /> }],
      { initialEntries: ["/stories/ai-story/edit"] },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  };

  it("preselects the saved day and week for an AI-generated story", async () => {
    renderPage();

    const selectTriggers = await screen.findAllByRole("combobox");

    await waitFor(() => {
      expect(selectTriggers.map((trigger) => trigger.textContent)).toContain(
        i18n.t("days.monday"),
      );
      expect(
        selectTriggers.some((trigger) => /^40\s+-/.test(trigger.textContent || "")),
      ).toBe(true);
    });
  });

  it("keeps the saved age group and language, and the form stays clean", async () => {
    mockStory.current = { ...mockStory.current!, age_group: "2-3", locale: "en" };
    renderPage();

    await waitFor(() => {
      const triggers = screen.getAllByRole("combobox").map((trigger) => trigger.textContent);
      expect(triggers).toContain(i18n.t("ages.2-3"));
      expect(triggers).toContain(i18n.t("languages.en"));
    });
    expect(screen.queryByText(i18n.t("editor.unsaved"))).not.toBeInTheDocument();
  });
});
