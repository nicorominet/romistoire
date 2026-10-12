import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { generationJobsApi } from "@/api/generationJobs.api";
import { CoverageGrid } from "./CoverageGrid";

vi.mock("@/lib/i18n", () => ({
  i18n: {
    t: (key: string, params: Record<string, string> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), key),
  },
}));

vi.mock("@/api/generationJobs.api", () => ({
  generationJobsApi: { coverage: vi.fn(), suggestTopics: vi.fn() },
}));

vi.mock("@/hooks/useSeries", () => ({
  useSeries: () => ({ data: [{ id: "ser1", name: "Famille Silvestre", castCount: 1 }, { id: "ser2", name: "Antonin", castCount: 0 }] }),
}));

const wrap = (ui: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("CoverageGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generationJobsApi.coverage as ReturnType<typeof vi.fn>).mockResolvedValue({
      weeks: [
        { weekNumber: 1, topic: "Les volcans" },
        { weekNumber: 2, topic: null },
        { weekNumber: 3, topic: "La pluie" },
      ],
      ages: ["4-6", "7-9"],
      cells: { "1:4-6": { total: 7, days: 7 }, "3:7-9": { total: 3, days: 3 } },
    });
  });

  it("shows written days, blocks complete cells and weeks without topic", async () => {
    wrap(<CoverageGrid onGenerate={vi.fn()} />);
    const cells = await screen.findAllByRole("button", { pressed: false });

    // 3 weeks x 2 ages
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveTextContent("7/7");
    expect(cells[0]).toBeDisabled(); // complete
    expect(cells[2]).toBeDisabled(); // week 2: no topic
    expect(cells[5]).toHaveTextContent("3/7");
    expect(cells[5]).not.toBeDisabled();
    expect(screen.getByText("generation.coverage.suggestTopics")).toBeInTheDocument();
  });

  it("turns the selected cells into a job pre-fill", async () => {
    const onGenerate = vi.fn();
    wrap(<CoverageGrid onGenerate={onGenerate} />);
    const cells = await screen.findAllByRole("button", { pressed: false });

    fireEvent.click(cells[1]); // week 1, 7-9
    fireEvent.click(cells[5]); // week 3, 7-9
    expect(cells[1]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByText("generation.coverage.generateSelection"));

    expect(onGenerate).toHaveBeenCalledWith({ weeks: [1, 3], ages: ["7-9"] });
  });

  it("counts one series: an age group without cast is greyed, the selection carries the series", async () => {
    const onGenerate = vi.fn();
    (generationJobsApi.coverage as ReturnType<typeof vi.fn>).mockImplementation(async (series: string) => ({
      weeks: [{ weekNumber: 1, topic: "Les volcans" }],
      ages: ["4-6", "7-9"],
      cells: {},
      ...(series === "ser1" ? { series: { id: "ser1", name: "Famille Silvestre", framed: true, castAges: ["4-6"] } } : {}),
    }));
    wrap(<CoverageGrid onGenerate={onGenerate} />);
    await screen.findAllByRole("button", { pressed: false });

    fireEvent.change(screen.getByLabelText("generation.coverage.seriesFilter"), { target: { value: "ser1" } });
    expect(generationJobsApi.coverage).toHaveBeenLastCalledWith("ser1");
    await screen.findByText(/Famille Silvestre :/);
    const cells = screen.getAllByRole("button", { pressed: false }).filter((b) => b.getAttribute("aria-label")?.startsWith("generation.coverage.cellLabel"));
    expect(cells[0]).not.toBeDisabled(); // 4-6: cast
    expect(cells[1]).toBeDisabled(); // 7-9: no cast

    fireEvent.click(cells[0]);
    fireEvent.click(screen.getByText("generation.coverage.generateSelection"));
    expect(onGenerate).toHaveBeenCalledWith({ weeks: [1], ages: ["4-6"], seriesId: "ser1", seriesName: "Famille Silvestre", framed: true });
  });
});
