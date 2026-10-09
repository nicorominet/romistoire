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
  source: 'manual' | 'gemini' | 'ollama';
  is_manually_edited: boolean;
  audio_path?: string;
  /** AI-suggested description used to create the illustration */
  illustration_prompt?: string | null;
  illustrations: Illustration[];
  /** Indicative review status: AI stories wait for a human reading */
  review_status?: 'to_review' | 'validated';
  /** Mass generation job that wrote the story */
  generation_job_id?: string | null;
  /** Set by create/update when the slot was taken and the story was moved to an alias series */
  aliasSeries?: { id: string; name: string } | null;
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
  locale?: string;
  theme_id?: string;
  age_group?: string;
  week_number?: number;
  day_of_week?: string;
  search?: string;
  hasImage?: string;
  hasAudio?: string;
  seriesId?: string;
  excludeSeriesId?: string;
   // Add other filters as needed to match findAll params
  theme?: string; // Align with findAll 'theme' vs 'theme_id'
  ageGroup?: string; // Align with findAll 'ageGroup'
  weekNumber?: string; // Align with findAll 'weekNumber'
  dayOfWeek?: string; // Align with findAll 'dayOfWeek'
  source?: string;
  editStatus?: string;
  reviewStatus?: string;
  generationJobId?: string;
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
  /** Visual style of the PDF; "auto" follows the youngest age group of the stories */
  style?: 'auto' | 'kids' | 'teen' | 'pro';
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

