import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Theme } from "@/types/Theme";
import { ThemeBadge } from "./ThemeBadge";
import { ThemeSelect, ThemeMultiSelect, toggleSelectedTheme, setPrimaryTheme, withOnePrimary } from "./ThemeSelect";

vi.mock("@/lib/i18n", () => ({
  i18n: {
    t: (key: string, params: Record<string, string> = {}) =>
      Object.entries(params).reduce((text, [name, value]) => text.replace(`{{${name}}}`, value), key),
    getCurrentLocale: () => "fr",
  },
}));

const theme = (id: string, name: string, extra: Partial<Theme> = {}): Theme => ({
  id, name, description: "", color: "#3b82f6", created_at: "", storyCount: 0, ...extra,
});

const themes = [theme("t1", "Océans", { icon: "🌊", storyCount: 4 }), theme("t2", "Amitié")];

describe("ThemeBadge", () => {
  it("shows the icon, the star of the primary theme and links to the filtered library", () => {
    render(<MemoryRouter><ThemeBadge theme={themes[0]} primary linkToStories /></MemoryRouter>);

    expect(screen.getByText("🌊")).toBeInTheDocument();
    expect(screen.getByLabelText("themes.primary")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/stories?theme=t1");
  });

  it("offers a remove button", () => {
    const onRemove = vi.fn();
    render(<ThemeBadge theme={themes[1]} onRemove={onRemove} />);

    fireEvent.click(screen.getByLabelText("themes.removeFromStory"));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("selected themes helpers", () => {
  it("keeps exactly one primary theme", () => {
    const added = toggleSelectedTheme([], "a");
    expect(added).toEqual([{ id: "a", isPrimary: true }]);

    const two = toggleSelectedTheme(added, "b");
    expect(two).toEqual([{ id: "a", isPrimary: true }, { id: "b", isPrimary: false }]);

    expect(setPrimaryTheme(two, "b")).toEqual([{ id: "a", isPrimary: false }, { id: "b", isPrimary: true }]);
    // Removing the primary theme promotes the next one
    expect(toggleSelectedTheme(two, "a")).toEqual([{ id: "b", isPrimary: true }]);
    expect(withOnePrimary([])).toEqual([]);
  });
});

describe("ThemeMultiSelect", () => {
  it("makes a theme primary with its star", () => {
    const onChange = vi.fn();
    render(
      <ThemeMultiSelect
        themes={themes}
        value={[{ id: "t1", isPrimary: true }, { id: "t2", isPrimary: false }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getAllByLabelText("themes.makePrimary")[0]);
    expect(onChange).toHaveBeenCalledWith([{ id: "t1", isPrimary: false }, { id: "t2", isPrimary: true }]);
  });
});

describe("ThemeSelect", () => {
  it("searches without accents and warns about a similar theme before creating", async () => {
    const onCreate = vi.fn(async (name: string) => theme("t3", name));
    const onChange = vi.fn();
    render(<ThemeSelect themes={themes} value={null} onChange={onChange} placeholder="pick" onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("themes.searchThemes");

    fireEvent.change(input, { target: { value: "ocean" } });
    expect(await screen.findByText("Océans")).toBeInTheDocument();
    expect(screen.queryByText("Amitié")).not.toBeInTheDocument();
    expect(screen.getByText("themes.similarExists")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Volcans" } });
    fireEvent.click(await screen.findByText("themes.createNamed"));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Volcans"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("t3"));
  });
});
