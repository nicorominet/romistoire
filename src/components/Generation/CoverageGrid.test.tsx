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
});
