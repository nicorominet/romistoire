import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SafeImage from "./SafeImage";

describe("SafeImage", () => {
  it("follows a new src (other story shown by the same card)", () => {
    const { rerender } = render(<SafeImage src="/uploads/a.jpg" alt="A" />);
    expect(screen.getByRole("img", { name: "A" })).toHaveAttribute("src", "/uploads/a.jpg");

    rerender(<SafeImage src="/uploads/b.jpg" alt="B" />);
    expect(screen.getByRole("img", { name: "B" })).toHaveAttribute("src", "/uploads/b.jpg");
  });

  it("shows a placeholder when the file cannot be loaded, then loads the next src again", () => {
    const { rerender, container } = render(<SafeImage src="/uploads/missing.jpg" alt="Missing" className="h-12 w-12" />);
    fireEvent.error(screen.getByRole("img", { name: "Missing" }));

    const placeholder = screen.getByRole("img", { name: "Missing" });
    expect(placeholder.tagName).toBe("SPAN");
    expect(placeholder).toHaveClass("h-12", "w-12");
    expect(container.querySelector("img")).toBeNull();

    rerender(<SafeImage src="/uploads/ok.jpg" alt="Ok" />);
    expect(screen.getByRole("img", { name: "Ok" })).toHaveAttribute("src", "/uploads/ok.jpg");
  });
});
