/**
 * Mass generation jobs (server-side queue, see server/services/generation_job.service.js).
 */

export type JobStatus = 'queued' | 'running' | 'paused' | 'cancelled' | 'done' | 'failed';
export type UnitStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** What the user asks for. Days are the French names expected by the prompt ("Lundi"…, "Toute la semaine"). */
export interface GenerationJobInput {
    weeks: number[];
    ages: string[];
    day: string;
    numCharacters?: number | null;
    charNames?: string;
    seriesName?: string;
    provider: 'gemini' | 'local';
    model?: string | null;
    skipExisting: boolean;
}

export interface GenerationEstimate {
    units: number;
    toGenerate: number;
    skipped: number;
    missingTopics: number[];
    requests: number;
    estimatedSeconds: number;
    quotaWarning: boolean;
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
    params: Omit<GenerationJobInput, 'numCharacters'> & { numCharacters: number | null };
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
