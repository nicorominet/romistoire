import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Brain, Loader2, Plus, Rocket } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_ROUTES } from "@/constants";
import { useSeriesCasts } from "@/hooks/useSeriesCasts";
import { Series } from "@/types/Series";
import { WeeklyTheme } from "@/types/Theme";
import { CastEditor, selectClass } from "./CastEditor";
import { FactsAndRecaps } from "./FactsAndRecaps";
import { FramedJobForm } from "./FramedJobForm";

const NEW_CAST = "new";
const tabClass = "flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700";

interface FramedGenerationTabProps {
  series: Series[];
  weeklyThemes: WeeklyTheme[];
  /** Series chosen from a link (?tab=framed&series=<id>) */
  initialSeriesId: string | null;
  onJobCreated: (jobId: string) => void;
}

/**
 * FramedGenerationTab Component
 *
 * Framed generation: a series bible (cast per age groups) followed week after week, its memory (facts and recaps)
 * and audits, and the launch of the jobs. The free generation tab is not affected.
 */
export const FramedGenerationTab = ({ series, weeklyThemes, initialSeriesId, onJobCreated }: FramedGenerationTabProps) => {
  const { t } = i18n;
  const [seriesId, setSeriesId] = useState<string | null>(initialSeriesId);
  const [castId, setCastId] = useState<string>(NEW_CAST);
  const [section, setSection] = useState("bible");
  const { data, isLoading } = useSeriesCasts(seriesId);
  const casts = data?.casts ?? [];
  const cast = casts.find((c) => c.id === castId) ?? null;

  useEffect(() => { if (initialSeriesId) setSeriesId(initialSeriesId); }, [initialSeriesId]);
  // First cast of the series selected; a new one when it has none
  useEffect(() => {
    if (!isLoading) setCastId((current) => (casts.some((c) => c.id === current) ? current : casts[0]?.id ?? NEW_CAST));
  }, [seriesId, isLoading, casts]);
  useEffect(() => { if (!cast) setSection("bible"); }, [cast]);

  if (series.length === 0) {
    return (
      <div className="space-y-2 text-sm">
        <p>{t("framed.noSeries")}</p>
        <Button asChild variant="outline"><Link to={APP_ROUTES.SERIES_MANAGEMENT}>{t("framed.openSeries")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 dark:text-gray-400">{t("framed.intro")}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="framed-series">{t("story.series")}</Label>
          <select id="framed-series" className={selectClass} value={seriesId ?? ""} onChange={(e) => setSeriesId(e.target.value || null)}>
            <option value="">{t("framed.chooseSeries")}</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {seriesId && (
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("framed.casts")}</span>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : (
              <div className="flex flex-wrap gap-2">
                {casts.map((c) => (
                  <Button key={c.id} type="button" size="sm" variant={c.id === castId ? "default" : "outline"} onClick={() => setCastId(c.id)}>
                    {c.name} · {c.ageGroups.join(", ")}
                  </Button>
                ))}
                <Button type="button" size="sm" variant={castId === NEW_CAST ? "default" : "outline"} className="gap-1" onClick={() => setCastId(NEW_CAST)}>
                  <Plus className="h-4 w-4" /> {t("framed.newCast")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {seriesId && !isLoading && (
        <Tabs value={section} onValueChange={setSection}>
          <TabsList className="mb-4 h-auto flex-wrap justify-start bg-white/50 dark:bg-slate-800/50">
            <TabsTrigger value="bible" className={tabClass}><BookOpen className="h-4 w-4" /> {t("framed.sections.bible")}</TabsTrigger>
            <TabsTrigger value="memory" className={tabClass} disabled={!cast}><Brain className="h-4 w-4" /> {t("framed.sections.memory")}</TabsTrigger>
            <TabsTrigger value="launch" className={tabClass} disabled={!cast}><Rocket className="h-4 w-4" /> {t("framed.sections.launch")}</TabsTrigger>
          </TabsList>

          <TabsContent value="bible">
            <CastEditor
              seriesId={seriesId}
              cast={cast}
              legacySheet={data?.legacySheet ?? ""}
              takenAges={casts.filter((c) => c.id !== cast?.id).flatMap((c) => c.ageGroups)}
              onSaved={(saved) => setCastId(saved.id)}
              onDeleted={() => setCastId(NEW_CAST)}
            />
          </TabsContent>
          {cast && (
            <>
              <TabsContent value="memory">
                <FactsAndRecaps cast={cast} onJobCreated={onJobCreated} />
              </TabsContent>
              <TabsContent value="launch">
                <FramedJobForm cast={cast} weeklyThemes={weeklyThemes} onCreated={onJobCreated} />
              </TabsContent>
            </>
          )}
        </Tabs>
      )}
    </div>
  );
};
