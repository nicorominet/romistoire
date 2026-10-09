/** Styles of the PDF export (see server/lib/pdf/themes.js: same rule for "auto"). */
export type PdfStyle = "auto" | "kids" | "teen" | "pro";
export type ResolvedPdfStyle = Exclude<PdfStyle, "auto">;

export const PDF_STYLES: PdfStyle[] = ["auto", "kids", "teen", "pro"];

const YOUNG_AGES = ["2-3", "4-6"];

/**
 * Style actually used: the chosen one, or in "auto" Kids when a story is for ages 2-6, Teen otherwise.
 * @param style - Chosen style.
 * @param ageGroups - Age groups of the selected stories.
 */
export const resolvePdfStyle = (style: PdfStyle, ageGroups: string[]): ResolvedPdfStyle => {
  if (style !== "auto") return style;
  return ageGroups.some(age => YOUNG_AGES.includes(age)) ? "kids" : "teen";
};
