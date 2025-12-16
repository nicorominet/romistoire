export interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  icon?: string | null;
  created_at: string;
  updated_at?: string;
  story_count?: number;
}
export interface WeeklyTheme {
  week_number: number;
  theme_name: string;
  theme_description: string;
  id?: string;
  created_at?: string;
}
