import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { themeApi } from "@/api/themes.api";
import { Theme } from "@/types/Theme";
import { ThemeListItem } from "./ThemeListItem";

vi.mock("@/lib/i18n", () => ({
  i18n: {
    t: (key: string, params: Record<string, string> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), key),
    getCurrentLocale: () => "fr",
  },
}));

vi.mock("@/api/themes.api", () => ({
  themeApi: { getStories: vi.fn() },
  weeklyThemeApi: {},
}));

const theme = (extra: Partial<Theme> = {}): Theme => ({
  id: "t1", name: "Océans", description: "", color: "#3b82f6", created_at: "", storyCount: 0, ...extra,
});

const wrap = (ui: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><ul>{ui}</ul></MemoryRouter></QueryClientProvider>);
};

const actions = { onEdit: vi.fn(), onMerge: vi.fn(), onDelete: vi.fn() };

describe("ThemeListItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers a selection checkbox only for unused themes", () => {
    const onSelectedChange = vi.fn();
    const { unmount } = wrap(<ThemeListItem theme={theme()} {...actions} onSelectedChange={onSelectedChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "themes.bulk.select" }));
    expect(onSelectedChange).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), true);
    unmount();

    wrap(<ThemeListItem theme={theme({ storyCount: 2 })} {...actions} onSelectedChange={onSelectedChange} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("expands the list of its stories", async () => {
    vi.mocked(themeApi.getStories).mockResolvedValue([
      { id: "s1", title: "La baleine bleue", age_group: "4-6", week_number: 12, day_order: 1 },
    ]);
    wrap(<ThemeListItem theme={theme({ storyCount: 1 })} {...actions} />);

    expect(themeApi.getStories).not.toHaveBeenCalled();
    const toggle = screen.getByRole("button", { name: /themes.storyCount/ });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const link = await screen.findByRole("link", { name: /La baleine bleue/ });
    expect(link).toHaveAttribute("href", "/stories/s1");
    expect(themeApi.getStories).toHaveBeenCalledWith("t1");
  });
});
