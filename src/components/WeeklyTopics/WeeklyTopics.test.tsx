import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { weeklyThemeApi } from "@/api/themes.api";
import { weekMonth, weeksInIsoYear } from "@/utils/weekUtils";
import { WeeklyTopicCalendar } from "./WeeklyTopicCalendar";
import { WeeklyTopicRow } from "./WeeklyTopicRow";

vi.mock("@/lib/i18n", () => ({
  i18n: {
    t: (key: string, params: Record<string, string> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), key),
    getCurrentLocale: () => "fr",
  },
}));

vi.mock("@/api/themes.api", () => ({
  themeApi: {},
  weeklyThemeApi: { getAll: vi.fn(), setWeek: vi.fn(), clearWeek: vi.fn() },
}));

const wrap = (ui: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
};

describe("WeeklyTopicCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens a single navigable month and lists legacy weeks apart", async () => {
    vi.mocked(weeklyThemeApi.getAll).mockResolvedValue([
      { week_number: 1, theme_name: "La neige" },
      { week_number: 88, theme_name: "Ancienne semaine" },
    ]);

    wrap(<WeeklyTopicCalendar year={2026} onYearChange={vi.fn()} />);

    const monthSelect = await screen.findByRole("combobox");
    fireEvent.change(monthSelect, { target: { value: String(weekMonth(1, 2026)) } });
    expect(await screen.findByDisplayValue("La neige")).toBeInTheDocument();
    const expectedMonthWeeks = Array.from({ length: weeksInIsoYear(2026) }, (_, index) => index + 1)
      .filter(week => weekMonth(week, 2026) === weekMonth(1, 2026)).length;
    expect(screen.getAllByPlaceholderText("weeklyTopics.topicPlaceholder")).toHaveLength(expectedMonthWeeks);
    expect(screen.getByText("weeklyTopics.invalidWeeks")).toBeInTheDocument();
    expect(screen.getByText(/Ancienne semaine/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Ancienne semaine")).not.toBeInTheDocument();
  });

  it("removes the legacy weeks", async () => {
    vi.mocked(weeklyThemeApi.getAll).mockResolvedValue([{ week_number: 88, theme_name: "Ancienne" }, { week_number: 96, theme_name: "Autre" }]);
    vi.mocked(weeklyThemeApi.clearWeek).mockResolvedValue({ success: true });

    wrap(<WeeklyTopicCalendar year={2027} onYearChange={vi.fn()} />);
    fireEvent.click(await screen.findByText("weeklyTopics.removeAll"));

    await waitFor(() => expect(weeklyThemeApi.clearWeek).toHaveBeenCalledTimes(2));
    expect(weeklyThemeApi.clearWeek).toHaveBeenCalledWith(88);
    expect(weeklyThemeApi.clearWeek).toHaveBeenCalledWith(96);
  });

  it("filters the week list to configured topics or weeks still to plan", async () => {
    vi.mocked(weeklyThemeApi.getAll).mockResolvedValue([
      { week_number: 1, theme_name: "La neige" },
      { week_number: 2, theme_name: "" },
    ]);

    wrap(<WeeklyTopicCalendar year={2026} onYearChange={vi.fn()} />);

    fireEvent.change(await screen.findByRole("combobox"), { target: { value: String(weekMonth(1, 2026)) } });
    expect(await screen.findByDisplayValue("La neige")).toBeInTheDocument();
    const monthWeekCount = Array.from({ length: weeksInIsoYear(2026) }, (_, index) => index + 1)
      .filter(week => weekMonth(week, 2026) === weekMonth(1, 2026)).length;
    expect(screen.getAllByPlaceholderText("weeklyTopics.topicPlaceholder")).toHaveLength(monthWeekCount);

    fireEvent.click(screen.getByText("weeklyTopics.view.configured"));
    expect(screen.getAllByPlaceholderText("weeklyTopics.topicPlaceholder")).toHaveLength(1);

    fireEvent.click(screen.getByText("weeklyTopics.view.empty"));
    expect(screen.getAllByPlaceholderText("weeklyTopics.topicPlaceholder")).toHaveLength(monthWeekCount - 1);
  });
});

describe("WeeklyTopicRow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a free topic when the field loses focus", async () => {
    vi.mocked(weeklyThemeApi.setWeek).mockResolvedValue({ week_number: 12, theme_name: "Les volcans" });
    wrap(<ul><WeeklyTopicRow weekNumber={12} rangeLabel="16 – 22 mars" /></ul>);

    const input = screen.getByLabelText("weeklyTopics.topicOfWeekNumber");
    fireEvent.change(input, { target: { value: "  Les volcans " } });
    fireEvent.blur(input);

    await waitFor(() => expect(weeklyThemeApi.setWeek).toHaveBeenCalledWith(12, { name: "Les volcans", description: "" }));
  });

  it("removes the week when the topic is emptied, and does nothing when unchanged", async () => {
    vi.mocked(weeklyThemeApi.clearWeek).mockResolvedValue({ success: true });
    wrap(<ul><WeeklyTopicRow weekNumber={5} rangeLabel="" week={{ week_number: 5, theme_name: "Neige", theme_description: "" }} /></ul>);

    const input = screen.getByLabelText("weeklyTopics.topicOfWeekNumber");
    fireEvent.blur(input);
    expect(weeklyThemeApi.setWeek).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(weeklyThemeApi.clearWeek).toHaveBeenCalledWith(5));
  });
});
