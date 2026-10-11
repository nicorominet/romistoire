/**
 * Framed generation: the bible of a series (see server/services/series_cast.service.js).
 * A cast covers one or more age groups; each age group tells its own story with the same characters.
 */

export const RELATION_TYPES = [
    "parent", "child", "grandparent", "grandchild", "sibling", "cousin", "friend", "partner", "pet", "owner", "other",
] as const;
export type RelationType = typeof RELATION_TYPES[number];

export const PHYSICAL_FIELDS = ["hair", "eyes", "build", "clothing", "distinctive"] as const;
export type PhysicalField = typeof PHYSICAL_FIELDS[number];

export interface CastCharacter {
    key: string;
    name: string;
    role: "main" | "recurring";
    species: string;
    gender: string;
    /** Age at the reference week of the cast */
    age: number | null;
    /** "MM-DD": the age grows on this day */
    birthday: string | null;
    physical: Record<PhysicalField, string>;
    personality: string;
    speech: string;
    /** Fixed sentence given to every illustration */
    visual: string;
    relations: { to: string; type: RelationType }[];
}

export interface Cast {
    id: string;
    seriesId: string;
    name: string;
    ageGroups: string[];
    universe: string;
    rules: string[];
    characters: CastCharacter[];
    /** Week at which the ages are given */
    referenceWeek: number;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export type CastInput = Pick<Cast, "name" | "ageGroups" | "universe" | "rules" | "characters" | "referenceWeek">;

export interface CastIssue {
    code: string;
    character?: string;
    detail?: string;
}

export interface CastValidation {
    cast: CastInput;
    errors: CastIssue[];
    warnings: CastIssue[];
}

export interface CastFact {
    id: string;
    castId: string;
    ageGroup: string;
    weekNumber: number;
    text: string;
    status: "proposed" | "approved" | "rejected";
    sourceStoryId: string | null;
}

export type AuditSeverity = "low" | "medium" | "high";

export interface AuditIssue {
    day: string;
    character: string;
    type: string;
    quote: string;
    explanation: string;
    severity: AuditSeverity;
    source: "ai" | "local";
}

export interface WeekAudit {
    status: "done" | "local" | "postponed" | "failed";
    issues: AuditIssue[];
    newFacts: string[];
    model: string | null;
    at: string;
    note?: string;
    storyIds?: string[];
    castVersion?: number;
}

export interface WeekRecap {
    ageGroup: string;
    weekNumber: number;
    recap: string;
    audit: WeekAudit | null;
    /** An earlier week was rewritten: to audit again */
    stale: boolean;
    updatedAt: string;
}
