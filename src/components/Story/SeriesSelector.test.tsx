import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { SeriesSelector } from "./SeriesSelector";
import { Series } from "@/types/Series";

vi.mock("@/lib/i18n", () => ({
  i18n: {
    t: (key: string, params: Record<string, string> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => `${text} ${name}=${value}`, key),
  },
}));

beforeAll(() => {
  // cmdk / Radix need these browser APIs
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

const series = [
  { id: "1", name: "Léon le lion", storyCount: 3 },
  { id: "2", name: "Les Explorateurs", storyCount: 0 },
] as Series[];

const open = () => fireEvent.click(screen.getByRole("combobox"));
// The cmdk search field
const type = (text: string) => fireEvent.change(screen.getByPlaceholderText("series.selector.searchPlaceholder"), { target: { value: text } });

describe("SeriesSelector", () => {
  it("guides an empty library instead of offering to create an empty name", () => {
    render(<SeriesSelector series={[]} value="" onChange={vi.fn()} />);
    open();

    expect(screen.getByText("series.selector.emptyHint")).toBeInTheDocument();
    expect(screen.queryByText(/series\.selector\.createNamed/)).not.toBeInTheDocument();
  });

  it("offers to create a name close to an existing series", () => {
    const onChange = vi.fn();
    render(<SeriesSelector series={series} value="" onChange={onChange} />);
    open();
    type("  Léo ");

    fireEvent.click(screen.getByText("series.selector.createNamed name=Léo"));
    expect(onChange).toHaveBeenCalledWith("Léo");
  });

  it("does not offer to create a name that exists, case and accents aside", () => {
    render(<SeriesSelector series={series} value="" onChange={vi.fn()} />);
    open();
    type("les explorateurs");

    expect(screen.queryByText(/series\.selector\.createNamed/)).not.toBeInTheDocument();
    expect(screen.getByText("Les Explorateurs")).toBeInTheDocument();
  });

  it("removes the series and flags a name that is not created yet", () => {
    const onChange = vi.fn();
    render(<SeriesSelector series={series} value="Ma nouvelle série" onChange={onChange} />);

    expect(screen.getByText("(series.selector.newBadge)")).toBeInTheDocument();
    expect(screen.getByText("series.selector.newHint")).toBeInTheDocument();

    open();
    fireEvent.click(screen.getByText("series.selector.none"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
