import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generationJobsApi } from '../api/generationJobs.api';
import { GenerationJob, GenerationJobInput } from '../types/generation.types';

const JOBS_KEY = ['generation-jobs'];
const COVERAGE_KEY = ['generation-coverage'];
/** Refresh rate while a job is queued or running. */
const POLL_MS = 3000;

export const isActiveJob = (job?: Pick<GenerationJob, 'status'> | null) => job?.status === 'queued' || job?.status === 'running';

/**
 * Jobs list, polled while one of them is active.
 */
export const useGenerationJobs = () =>
    useQuery({
        queryKey: JOBS_KEY,
        queryFn: () => generationJobsApi.list(),
        refetchInterval: (query) => ((query.state.data as GenerationJob[] | undefined)?.some(isActiveJob) ? POLL_MS : false),
        refetchOnWindowFocus: true,
    });

/**
 * One job with its units and log, polled while it is active.
 */
export const useGenerationJob = (id: string | null) =>
    useQuery({
        queryKey: [...JOBS_KEY, id],
        queryFn: () => generationJobsApi.get(id!),
        enabled: Boolean(id),
        refetchInterval: (query) => (isActiveJob(query.state.data as GenerationJob | undefined) ? POLL_MS : false),
    });

export const useCoverage = () =>
    useQuery({ queryKey: COVERAGE_KEY, queryFn: () => generationJobsApi.coverage() });

/**
 * Job actions. Every change refreshes the jobs; stories and coverage too when stories may have changed.
 */
export const useGenerationJobMutations = () => {
    const queryClient = useQueryClient();
    const refreshJobs = () => queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    const refreshAll = () => {
        refreshJobs();
        queryClient.invalidateQueries({ queryKey: COVERAGE_KEY });
        queryClient.invalidateQueries({ queryKey: ['stories'] });
    };

    const create = useMutation({ mutationFn: (input: GenerationJobInput) => generationJobsApi.create(input), onSuccess: refreshJobs });
    const action = useMutation({
        mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' | 'cancel' | 'retry-failed' | 'validate' }) =>
            generationJobsApi.action(id, action),
        onSuccess: refreshAll,
    });
    const deleteStories = useMutation({ mutationFn: (id: string) => generationJobsApi.deleteStories(id), onSuccess: refreshAll });

    return { create, action, deleteStories };
};
