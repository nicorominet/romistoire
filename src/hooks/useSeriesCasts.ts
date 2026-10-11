import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { seriesCastApi } from '../api/seriesCast.api';
import { CastFact, CastInput } from '../types/framed.types';

const castsKey = (seriesId: string | null) => ['series-casts', seriesId];
const factsKey = (castId: string | null) => ['cast-facts', castId];
const recapsKey = (castId: string | null) => ['cast-recaps', castId];

/** Casts of a series (bible of the framed generation). */
export const useSeriesCasts = (seriesId: string | null) =>
    useQuery({ queryKey: castsKey(seriesId), queryFn: () => seriesCastApi.list(seriesId!), enabled: Boolean(seriesId) });

export const useCastFacts = (castId: string | null) =>
    useQuery({ queryKey: factsKey(castId), queryFn: () => seriesCastApi.facts(castId!), enabled: Boolean(castId) });

export const useCastRecaps = (castId: string | null) =>
    useQuery({ queryKey: recapsKey(castId), queryFn: () => seriesCastApi.recaps(castId!), enabled: Boolean(castId) });

/** Changes of a bible: casts, facts and audits refresh what they touch. */
export const useSeriesCastMutations = (seriesId: string | null) => {
    const queryClient = useQueryClient();
    const refreshCasts = () => queryClient.invalidateQueries({ queryKey: castsKey(seriesId) });

    const save = useMutation({
        mutationFn: ({ castId, cast }: { castId: string | null; cast: CastInput }) =>
            (castId ? seriesCastApi.update(castId, cast) : seriesCastApi.create(seriesId!, cast)),
        onSuccess: refreshCasts,
    });
    const remove = useMutation({ mutationFn: (castId: string) => seriesCastApi.remove(castId), onSuccess: refreshCasts });

    const setFactStatus = useMutation({
        mutationFn: ({ factId, status }: { castId: string; factId: string; status: CastFact['status'] }) => seriesCastApi.setFactStatus(factId, status),
        onSuccess: (_result, { castId }) => queryClient.invalidateQueries({ queryKey: factsKey(castId) }),
    });
    const addFact = useMutation({
        mutationFn: ({ castId, fact }: { castId: string; fact: { ageGroup: string; weekNumber: number; text: string } }) => seriesCastApi.addFact(castId, fact),
        onSuccess: (_result, { castId }) => queryClient.invalidateQueries({ queryKey: factsKey(castId) }),
    });
    const removeFact = useMutation({
        mutationFn: ({ factId }: { castId: string; factId: string }) => seriesCastApi.removeFact(factId),
        onSuccess: (_result, { castId }) => queryClient.invalidateQueries({ queryKey: factsKey(castId) }),
    });
    const audit = useMutation({
        mutationFn: ({ castId, ageGroup, weekNumber }: { castId: string; ageGroup: string; weekNumber: number }) =>
            seriesCastApi.audit(castId, ageGroup, weekNumber),
        onSuccess: (_result, { castId }) => {
            queryClient.invalidateQueries({ queryKey: recapsKey(castId) });
            queryClient.invalidateQueries({ queryKey: factsKey(castId) });
        },
    });

    return { save, remove, setFactStatus, addFact, removeFact, audit };
};
