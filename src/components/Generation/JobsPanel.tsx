import { Link } from "react-router-dom";
import { CheckCheck, ExternalLink, Loader2, Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { APP_ROUTES, ALL_WEEK } from "@/constants";
import { mapFrToEnDay } from "@/utils/dayUtils";
import { isActiveJob, useGenerationJob, useGenerationJobMutations, useGenerationJobs } from "@/hooks/useGenerationJobs";
import { GenerationJob, JobStatus, UnitStatus } from "@/types/generation.types";

const STATUS_CLASS: Record<JobStatus | UnitStatus, string> = {
  queued: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  cancelled: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  skipped: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const StatusBadge = ({ status }: { status: JobStatus | UnitStatus }) => (
  <Badge variant="outline" className={`border-0 ${STATUS_CLASS[status]}`}>{i18n.t(`generation.status.${status}`)}</Badge>
);

const percent = (job: GenerationJob) => (job.totalUnits > 0 ? Math.round((job.doneUnits / job.totalUnits) * 100) : 0);

const dayLabel = (day: string) => (day === ALL_WEEK ? i18n.t("create.generate.allWeek") : i18n.t(`days.${mapFrToEnDay(day).toLowerCase()}`));

/** Weeks of a job, compact: "1-4, 7". */
const weeksLabel = (weeks: number[]) => {
  const ranges: string[] = [];
  let start = weeks[0];
  for (let i = 1; i <= weeks.length; i++) {
    if (weeks[i] !== weeks[i - 1] + 1) {
      ranges.push(start === weeks[i - 1] ? String(start) : `${start}-${weeks[i - 1]}`);
      start = weeks[i];
    }
  }
  return ranges.join(", ");
};

const JobActions = ({ job }: { job: GenerationJob }) => {
  const { t } = i18n;
  const { action } = useGenerationJobMutations();
  const run = (name: "pause" | "resume" | "cancel") =>
    action.mutate({ id: job.id, action: name }, { onError: (error) => toast.error((error as Error).message) });

  return (
    <div className="flex gap-1">
      {isActiveJob(job) && (
        <Button size="icon" variant="ghost" onClick={() => run("pause")} disabled={action.isPending} aria-label={t("generation.actions.pause")} title={t("generation.actions.pause")}>
          <Pause className="h-4 w-4" />
        </Button>
      )}
      {job.status === "paused" && (
        <Button size="icon" variant="ghost" onClick={() => run("resume")} disabled={action.isPending} aria-label={t("generation.actions.resume")} title={t("generation.actions.resume")}>
          <Play className="h-4 w-4" />
        </Button>
      )}
      {(isActiveJob(job) || job.status === "paused") && (
        <Button size="icon" variant="ghost" onClick={() => run("cancel")} disabled={action.isPending} aria-label={t("generation.actions.cancel")} title={t("generation.actions.cancel")}>
          <Square className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

/**
 * Detail of a job: units (week x age) with their status and stories, log, batch actions.
 */
const JobDetail = ({ jobId }: { jobId: string }) => {
  const { t } = i18n;
  const { data: job, isLoading } = useGenerationJob(jobId);
  const { action, deleteStories } = useGenerationJobMutations();

  if (isLoading || !job) return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const busy = isActiveJob(job);
  const handleRetry = () => action.mutate({ id: job.id, action: "retry-failed" }, {
    onSuccess: () => toast.success(t("generation.detail.retrying")),
    onError: (error) => toast.error((error as Error).message),
  });
  const handleValidate = () => action.mutate({ id: job.id, action: "validate" }, {
    onSuccess: (result) => toast.success(t("generation.detail.validated", { count: String((result as { updated: number }).updated) })),
    onError: (error) => toast.error((error as Error).message),
  });
  const handleDelete = () => deleteStories.mutate(job.id, {
    onSuccess: (result) => toast.success(t("generation.detail.deleted", { count: String(result.deleted) })),
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {job.failedCount > 0 && !busy && (
          <Button size="sm" variant="outline" onClick={handleRetry} disabled={action.isPending} className="gap-1">
            <RotateCcw className="h-4 w-4" /> {t("generation.detail.retryFailed", { count: String(job.failedCount) })}
          </Button>
        )}
        {job.createdCount > 0 && (
          <>
            <Button size="sm" variant="outline" asChild className="gap-1">
              <Link to={`${APP_ROUTES.STORIES}?generationJobId=${job.id}`}><ExternalLink className="h-4 w-4" /> {t("generation.detail.openStories")}</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={handleValidate} disabled={action.isPending} className="gap-1">
              <CheckCheck className="h-4 w-4" /> {t("generation.detail.validateAll")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy || deleteStories.isPending} className="gap-1 text-red-600">
                  <Trash2 className="h-4 w-4" /> {t("generation.detail.deleteStories")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("generation.detail.deleteTitle", { count: String(job.createdCount) })}</AlertDialogTitle>
                  <AlertDialogDescription>{t("generation.detail.deleteDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">{t("generation.detail.deleteStories")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <div className="max-h-[400px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("generation.detail.week")}</TableHead>
              <TableHead>{t("create.generate.age")}</TableHead>
              <TableHead>{t("generation.detail.status")}</TableHead>
              <TableHead>{t("generation.detail.stories")}</TableHead>
              <TableHead>{t("generation.detail.info")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {job.units?.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="whitespace-nowrap">{t("timeline.weekNumber", { number: unit.weekNumber })}</TableCell>
                <TableCell className="whitespace-nowrap">{t(`ages.${unit.ageGroup}`)}</TableCell>
                <TableCell><StatusBadge status={unit.status} /></TableCell>
                <TableCell>{unit.storyIds.length || ""}</TableCell>
                <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                  {unit.error && <span className={unit.status === "failed" ? "text-red-600 dark:text-red-400" : ""}>{unit.error}</span>}
                  {unit.model && <span className="ml-1 font-mono">{unit.error ? " · " : ""}{unit.model}</span>}
                  {unit.attempts > 1 && <span> · {t("generation.detail.attempts", { count: String(unit.attempts) })}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {job.log && job.log.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t("generation.detail.log")}</summary>
          <ul className="mt-2 max-h-60 space-y-0.5 overflow-auto font-mono text-xs text-gray-600 dark:text-gray-400">
            {[...job.log].reverse().map((entry, index) => (
              <li key={index}>{new Date(entry.at).toLocaleTimeString()} — {entry.message}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

interface JobsPanelProps {
  selectedJobId: string | null;
  onSelect: (jobId: string | null) => void;
}

/**
 * JobsPanel Component
 *
 * History of the mass generation jobs, newest first, with live progress and controls.
 */
export const JobsPanel = ({ selectedJobId, onSelect }: JobsPanelProps) => {
  const { t } = i18n;
  const { data: jobs = [], isLoading } = useGenerationJobs();

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (jobs.length === 0) return <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{t("generation.jobs.empty")}</p>;

  return (
    <ul className="space-y-3">
      {jobs.map((job) => (
        <li key={job.id} className="space-y-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(selectedJobId === job.id ? null : job.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selectedJobId === job.id ? null : job.id); } }}
            className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-white/60 dark:hover:bg-slate-800/60 ${selectedJobId === job.id ? "border-indigo-400" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={job.status} />
                <span className="font-medium">
                  {t("generation.jobs.summary", {
                    weeks: weeksLabel(job.params.weeks),
                    ages: job.params.ages.map((age) => t(`ages.${age}`)).join(", "),
                  })}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">· {dayLabel(job.params.day)} · {job.provider}</span>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <JobActions job={job} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={percent(job)} className="h-2 flex-1" aria-label={t("create.generate.progress")} />
              <span className="w-10 text-right text-xs text-gray-500">{percent(job)} %</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("generation.jobs.counts", {
                created: String(job.createdCount),
                failed: String(job.failedCount),
                skipped: String(job.skippedCount),
              })}
              {job.currentLabel && isActiveJob(job) && <> · {t("generation.jobs.current", { label: job.currentLabel })}</>}
              {" · "}{new Date(job.createdAt).toLocaleString()}
            </p>
          </div>
          {selectedJobId === job.id && <JobDetail jobId={job.id} />}
        </li>
      ))}
    </ul>
  );
};
