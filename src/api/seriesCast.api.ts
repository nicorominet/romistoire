import client from './client';
import { API_ENDPOINTS } from '../constants';
import { Cast, CastFact, CastInput, CastValidation, WeekAudit, WeekRecap } from '../types/framed.types';

/**
 * API Client for the bible of a framed series: casts, facts established by the weeks, recaps and audits.
 */
export const seriesCastApi = {
    /** Casts of a series, and its old automatic character sheet (a starting point for a first cast). */
    list: (seriesId: string) => client.get<{ casts: Cast[]; legacySheet: string }>(`${API_ENDPOINTS.SERIES}/${seriesId}/casts`),

    /** Cleans and checks a cast without saving it (ages checked on `weeks` when given). */
    validate: (seriesId: string, cast: CastInput, castId?: string | null, weeks: number[] = []) =>
        client.post<CastValidation>(`${API_ENDPOINTS.SERIES}/${seriesId}/casts/validate`, { cast, castId, weeks }),

    create: (seriesId: string, cast: CastInput) =>
        client.post<{ cast: Cast; warnings: CastValidation["warnings"] }>(`${API_ENDPOINTS.SERIES}/${seriesId}/casts`, cast),

    update: (castId: string, cast: CastInput) =>
        client.put<{ cast: Cast; warnings: CastValidation["warnings"] }>(`${API_ENDPOINTS.SERIES}/casts/${castId}`, cast),

    remove: (castId: string) => client.delete<{ success: boolean }>(`${API_ENDPOINTS.SERIES}/casts/${castId}`),

    facts: (castId: string) => client.get<CastFact[]>(`${API_ENDPOINTS.SERIES}/casts/${castId}/facts`),

    addFact: (castId: string, fact: { ageGroup: string; weekNumber: number; text: string }) =>
        client.post<CastFact>(`${API_ENDPOINTS.SERIES}/casts/${castId}/facts`, fact),

    setFactStatus: (factId: string, status: CastFact["status"]) =>
        client.patch<{ id: string; status: string }>(`${API_ENDPOINTS.SERIES}/facts/${factId}`, { status }),

    removeFact: (factId: string) => client.delete<{ success: boolean }>(`${API_ENDPOINTS.SERIES}/facts/${factId}`),

    recaps: (castId: string) => client.get<WeekRecap[]>(`${API_ENDPOINTS.SERIES}/casts/${castId}/recaps`),

    /** Audits a written week again (local checks, and the AI unless useAI is false). */
    audit: (castId: string, ageGroup: string, weekNumber: number, useAI = true) =>
        client.post<WeekAudit & { recap: string; stale: number }>(`${API_ENDPOINTS.SERIES}/casts/${castId}/audit`, { ageGroup, weekNumber, useAI }),
};
