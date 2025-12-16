/**
 * Story related type definitions
 * @module Story
 */

/**
 * Age group for stories categorization
 * @type {AgeGroup}
 */
export const AGE_GROUPS = ["2-3", "4-6", "7-9", "10-12", "13-15", "16-18"] as const;
export type AgeGroup = typeof AGE_GROUPS[number];

/**
 * Story interface representing a children's story
 * @interface Story
 */
import { Theme } from './Theme';

/**
 * Story interface representing a children's story
 * @interface Story
 */
export interface Story {
  id: string;
  title: string;
  content: string;
  themes: Theme[];
  series_id?: string;
  series_name?: string;
  age_group: AgeGroup | string; // Allow string for flexibility but prefer AgeGroup
  week_number: number;
  day_order: number;
  created_at: string;
  modified_at: string;
  version: number;
  locale: string;
  illustrations: Illustration[];
}

/**
 * Illustration interface for story visuals
 * @interface Illustration
 */
export interface Illustration {
  id: string;
  story_id: string;
  image_path?: string; // chemin relatif du fichier image
  filename?: string;
  fileType?: string;
  position?: number;
  created_at?: string;
}

/**
 * Version history for stories
 * @interface StoryVersion
 */
export interface StoryVersion {
  id: string;
  story_id: string;
  title: string;
  content: string;
  theme_id: string;
  age_group: string;
  created_at: string;
  version: number;
  illustrations: Illustration[];
}

/**
 * Pagination parameters for story listings
 * @interface PaginationParams
 */
export interface PaginationParams {
  page: number;
  limit: number;
  locale: string;
  theme_id?: string;
  age_group?: string;
  week_number?: number;
  day_of_week?: string;
}

/**
 * Export options for PDF generation
 * @interface ExportOptions
 */
export interface ExportOptions {
  stories: string[];
  coverTitle?: string;
  coverSubtitle?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'a5' | 'letter';
  fontSize?: 'small' | 'normal' | 'large' | 'medium';
  fontStyle?: 'serif' | 'sans' | 'mono';
  fontFamily?: string; // Add this line
  customFonts?: Record<string, string>;
  includeIllustrations?: boolean;
  coverPage?: boolean;
  tableOfContents?: boolean;
}

/**
 * Story with its illustrations for display or export
 * @interface StoryWithIllustrations
 */
export interface StoryWithIllustrations extends Story {
  illustrations: Illustration[];
}

