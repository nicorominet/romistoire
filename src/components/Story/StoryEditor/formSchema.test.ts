import { describe, it, expect } from "vitest";
import { formSchema } from "./formSchema";
import { AGE_GROUPS } from "@/types/Story";

const validValues = {
  title: "Titre",
  content: "Contenu",
  themes: [{ id: "theme-1", isPrimary: true }],
  ageGroup: "4-6",
  language: "fr",
  dayOfWeek: "Monday",
  weekNumber: "1",
  seriesName: "",
  version: 1,
};

describe("formSchema", () => {
  it.each(AGE_GROUPS)("accepts the %s age group", (ageGroup) => {
    expect(formSchema.safeParse({ ...validValues, ageGroup }).success).toBe(true);
  });

  it("rejects an unknown age group", () => {
    expect(formSchema.safeParse({ ...validValues, ageGroup: "19-25" }).success).toBe(false);
  });

  it("requires a day, a week and a known language", () => {
    expect(formSchema.safeParse({ ...validValues, dayOfWeek: "" }).success).toBe(false);
    expect(formSchema.safeParse({ ...validValues, weekNumber: "" }).success).toBe(false);
    expect(formSchema.safeParse({ ...validValues, weekNumber: "54" }).success).toBe(false);
    expect(formSchema.safeParse({ ...validValues, language: "fra" }).success).toBe(false);
  });

  it("rejects the empty editor content", () => {
    for (const content of ["", "<p></p>", "<p> &nbsp; </p><p><br></p>"]) {
      expect(formSchema.safeParse({ ...validValues, content }).success).toBe(false);
    }
    expect(formSchema.safeParse({ ...validValues, content: "<p>Il était une fois</p>" }).success).toBe(true);
  });

  it("uses i18n keys as messages", () => {
    const result = formSchema.safeParse({ ...validValues, title: "  " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("validation.titleRequired");
  });
});
