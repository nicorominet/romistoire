import * as z from "zod";
import { AGE_GROUPS } from "@/types/Story";

// Messages are i18n keys, translated when displayed by <FormMessage /> (components/ui/form.tsx)
export const formSchema = z.object({
  title: z.string().trim().min(1, "validation.titleRequired"),
  // The editor returns "<p></p>" when empty: the text without tags must not be empty
  content: z.string().refine((html) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length > 0, "validation.contentRequired"),
  // Story themes; exactly one is primary (enforced by the picker and by the server)
  themes: z.array(z.object({ id: z.string(), isPrimary: z.boolean() })).min(1, "validation.themeRequired"),
  ageGroup: z.enum(AGE_GROUPS, { message: "validation.ageGroupRequired" }),
  language: z.enum(["fr", "en"], { message: "validation.languageRequired" }),
  dayOfWeek: z.string().min(1, "validation.dayRequired"),
  weekNumber: z.string().regex(/^([1-9]|[1-4][0-9]|5[0-3])$/, "validation.weekRequired"),
  seriesName: z.string().optional(),
  version: z.number()
});

export type FormValues = z.infer<typeof formSchema>;
