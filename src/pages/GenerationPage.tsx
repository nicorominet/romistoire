import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Grid3x3, ListChecks, Wand2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import PageLayout from "@/components/Layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobForm } from "@/components/Generation/JobForm";
import { JobsPanel } from "@/components/Generation/JobsPanel";
import { CoverageGrid } from "@/components/Generation/CoverageGrid";
import { useWeeklyThemes } from "@/hooks/useThemes";
import { useSeries } from "@/hooks/useSeries";
import { Series } from "@/types/Series";
import { WeeklyTheme } from "@/types/Theme";
import { JobPrefill } from "@/types/generation.types";

const TABS = ["new", "jobs", "coverage"] as const;
type Tab = typeof TABS[number];

const tabClass = "flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700";

/**
 * GenerationPage Component
 *
 * Mass generation: jobs run by the server (they go on when the page is left or the tab closed),
 * their history and controls, and the coverage of the program (weeks x ages) to find the gaps.
 * The tab and the open job are kept in the URL (?tab=jobs&job=<id>).
 */
const GenerationPage = () => {
  const { t } = i18n;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "new";
  const selectedJobId = searchParams.get("job");
  const [prefill, setPrefill] = useState<JobPrefill | null>(null);

  const { data: weeklyThemes = [] } = useWeeklyThemes();
  const { data: series = [] } = useSeries();

  const go = (next: Tab, jobId: string | null = null) => {
    const params: Record<string, string> = {};
    if (next !== "new") params.tab = next;
    if (jobId) params.job = jobId;
    setSearchParams(params, { replace: true });
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-story-purple-800">{t("generation.title")}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t("generation.description")}</p>
        </div>

        <div className="rounded-xl border border-white/20 bg-white/40 p-6 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/40">
          <Tabs value={tab} onValueChange={(value) => go(value as Tab, value === "jobs" ? selectedJobId : null)}>
            <TabsList className="mb-6 h-auto flex-wrap justify-start bg-white/50 dark:bg-slate-800/50">
              <TabsTrigger value="new" className={tabClass}><Wand2 className="h-4 w-4" /> {t("generation.tabs.new")}</TabsTrigger>
              <TabsTrigger value="jobs" className={tabClass}><ListChecks className="h-4 w-4" /> {t("generation.tabs.jobs")}</TabsTrigger>
              <TabsTrigger value="coverage" className={tabClass}><Grid3x3 className="h-4 w-4" /> {t("generation.tabs.coverage")}</TabsTrigger>
            </TabsList>

            <TabsContent value="new">
              <JobForm
                weeklyThemes={weeklyThemes as WeeklyTheme[]}
                series={series as Series[]}
                prefill={prefill}
                onCreated={(jobId) => go("jobs", jobId)}
              />
            </TabsContent>

            <TabsContent value="jobs">
              <JobsPanel selectedJobId={selectedJobId} onSelect={(jobId) => go("jobs", jobId)} />
            </TabsContent>

            <TabsContent value="coverage">
              <CoverageGrid onGenerate={(cells) => { setPrefill(cells); go("new"); }} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
};

export default GenerationPage;
