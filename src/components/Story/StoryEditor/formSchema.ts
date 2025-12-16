import * as z from "zod";

export const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  themes: z.array(z.string()).min(1, "At least one theme is required"),
  ageGroup: z.enum(["2-3", "4-6", "7-9", "10-12"]),
  language: z.string().min(2),
  dayOfWeek: z.string(),
  weekNumber: z.string(),
  seriesName: z.string().optional(),
  version: z.number()
});

export type FormValues = z.infer<typeof formSchema>;
