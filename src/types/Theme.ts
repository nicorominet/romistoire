/**
 * A story theme (tag). Names are unique, ignoring case, accents and leading articles.
 */
export interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  icon?: string | null;
  /** 'ai': created by story generation */
  source?: 'manual' | 'ai';
  /** AI-created theme not reviewed by a human yet */
  needsReview?: boolean;
  created_at: string;
  updated_at?: string | null;
  storyCount?: number;
}

/** A theme as linked to a story. */
export interface StoryTheme extends Partial<Theme> {
  id: string;
  name: string;
  isPrimary?: boolean;
}

/** Theme fields shown by badges and pickers. */
export type ThemeLike = Pick<Theme, 'id' | 'name'> & Partial<Pick<Theme, 'color' | 'icon' | 'description' | 'storyCount'>>;

/**
 * Topic of a week: free text that guides story writing.
 * Not a story theme (tag): it is never linked to the `themes` table.
 */
export interface WeeklyTheme {
  week_number: number;
  theme_name: string;
  theme_description?: string;
}

/** Light story row of a theme's expandable list. */
export interface ThemeStory {
  id: string;
  title: string;
  age_group: string;
  week_number: number;
  day_order: number;
  locale?: string;
}

export type ThemeSort = 'name' | 'usage' | 'recent';

export interface ThemeFilters {
  search?: string;
  sort?: ThemeSort;
  needsReview?: boolean;
  unused?: boolean;
}

export interface ThemeInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string | null;
  source?: 'manual' | 'ai';
}
