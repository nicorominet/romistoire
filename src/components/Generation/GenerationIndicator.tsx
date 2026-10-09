import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { APP_ROUTES } from "@/constants";
import { isActiveJob, useGenerationJobs } from "@/hooks/useGenerationJobs";

/**
 * GenerationIndicator Component
 *
 * Shown in the header while a mass generation job runs on the server: progress and a link to it.
 */
export const GenerationIndicator = () => {
  const { t } = i18n;
  const { data: jobs = [] } = useGenerationJobs();
  const active = jobs.find((job) => job.status === "running") || jobs.find(isActiveJob);
  if (!active) return null;

  const percent = active.totalUnits > 0 ? Math.round((active.doneUnits / active.totalUnits) * 100) : 0;
  return (
    <Link
      to={`${APP_ROUTES.GENERATION}?tab=jobs&job=${active.id}`}
      className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300"
      title={active.currentLabel || t("generation.title")}
      aria-label={t("generation.indicator", { percent: String(percent) })}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {percent} %
    </Link>
  );
};
