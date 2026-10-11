/**
 * Mass generation jobs (server-side queue, see server/services/generation_job.service.js).
 */

/** scheduled: a framed job waiting for the next quota day (resumeAt) */
export type JobStatus = 'queued' | 'running' | 'paused' | 'scheduled' | 'cancelled' | 'done' | 'failed';
export type UnitStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** What the user asks for. Days are the French names expected by the prompt ("Lundi"…, "Toute la semaine"). */
export interface GenerationJobInput {
    weeks: number[];
    ages: string[];
    day: string;
    numCharacters?: number | null;
    charNames?: string;
    seriesName?: string;
    /** Omitted: the provider chosen in the settings */
    provider?: 'gemini' | 'local';
    model?: string | null;
    skipExisting: boolean;
    /** Rewrites the stories already written in place (same stories, illustrations kept, old text in the versions) */
    regenerate?: boolean;
    /** With regenerate: only these days ("Mercredi"…), the others being the context */
    regenerateDays?: string[];
    /** Only the recommended Flash models: when they are saturated, the day fails (retry later) instead of Flash Lite */
    flashOnly?: boolean;
    /** Framed generation (tab "Génération cadrée"): the cast of a series bible replaces the character settings */
    mode?: 'framed';
    castId?: string;
    /** Framed: audit of each week against the bible (+1 request a week) */
    audit?: boolean;
    /** Framed: requests a day at most (leaves quota for the free generation); null: no limit */
    dailyBudget?: number | null;
    /** Framed, with regenerate: the drifts found by the audit are given to the AI */
    fixDrift?: boolean;
}

export interface GenerationEstimate {
    units: number;
    toGenerate: number;
    skipped: number;
    missingTopics: number[];
    requests: number;
    estimatedSeconds: number;
    /** Requests left today on the fast Gemini models (Gemma aside); null when unknown */
    remainingRequests: number | null;
    /** Per model family: Flash (from 7 years old, about 20 requests a day each) and Flash Lite. null: not Gemini, or a chosen model */
    quota?: {
        flash: { requests: number; remaining: number | null };
        lite: { requests: number; remaining: number | null };
        /** More Flash requests than Flash quota left: the rest falls back to Flash Lite (or fails with flashOnly) */
        flashShortfall: boolean;
    } | null;
    quotaWarning: boolean;
    /** Framed on Gemini: requests a day it can send, left today, and the quota days it takes (null: unknown) */
    schedule?: { perDay: number | null; today: number | null; days: number | null };
}

export interface GenerationUnit {
    id: string;
    position: number;
    weekNumber: number;
    ageGroup: string;
    day: string;
    status: UnitStatus;
    storyIds: string[];
    error: string | null;
    attempts: number;
    model: string | null;
    updatedAt: string;
}

export interface GenerationJob {
    id: string;
    status: JobStatus;
    params: Omit<GenerationJobInput, 'numCharacters'> & { numCharacters: number | null; seriesId?: string };
    totalUnits: number;
    doneUnits: number;
    createdCount: number;
    failedCount: number;
    skippedCount: number;
    currentLabel: string | null;
    provider: string;
    model: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    /** Scheduled: when it starts again (UTC "YYYY-MM-DD HH:MM:SS") */
    resumeAt?: string | null;
    budgetUsed?: number;
    /** Detail only */
    log?: { at: string; message: string }[];
    units?: GenerationUnit[];
}

export interface CoverageCell {
    total: number;
    days: number;
}

export interface Coverage {
    weeks: { weekNumber: number; topic: string | null }[];
    ages: string[];
    /** Key "week:age", e.g. "12:4-6" */
    cells: Record<string, CoverageCell>;
}

export interface TopicSuggestion {
    week: number;
    name: string;
    description: string;
}

/** Pre-fill of the job form, e.g. from the coverage grid. */
export interface JobPrefill {
    weeks: number[];
    ages: string[];
}
