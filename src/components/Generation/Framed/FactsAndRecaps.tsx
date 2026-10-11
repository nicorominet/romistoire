import { useState } from "react";
import { Check, Loader2, Plus, RefreshCw, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCastFacts, useCastRecaps, useSeriesCastMutations } from "@/hooks/useSeriesCasts";
import { useGenerationJobMutations } from "@/hooks/useGenerationJobs";
import { Cast, CastFact, WeekRecap } from "@/types/framed.types";
import { selectClass } from "./CastEditor";

const SEVERITY_CLASS = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
} as const;

/** Days of a week the audit found drifting (high or medium). */
const driftingDays = (recap: WeekRecap) =>
  [...new Set((recap.audit?.issues ?? []).filter((issue) => issue.severity !== "low" && issue.day).map((issue) => issue.day))];

interface FactsAndRecapsProps {
  cast: Cast;
  onJobCreated: (jobId: string) => void;
}

/**
 * FactsAndRecaps Component
 *
 * Memory of a framed series: the facts its weeks established (proposed by the audit, to approve), and the recap
 * and audit of each week, with what to do about a drift (audit again, rewrite the drifting days).
 */
export const FactsAndRecaps = ({ cast, onJobCreated }: FactsAndRecapsProps) => {
  const { t } = i18n;
  const [ageGroup, setAgeGroup] = useState(cast.ageGroups[0]);
  const [newFact, setNewFact] = useState({ weekNumber: "", text: "" });
  const { data: facts = [] } = useCastFacts(cast.id);
  const { data: recaps = [], isLoading } = useCastRecaps(cast.id);
  const { setFactStatus, addFact, removeFact, audit } = useSeriesCastMutations(cast.seriesId);
  const { create } = useGenerationJobMutations();

  const ageFacts = facts.filter((fact) => fact.ageGroup === ageGroup);
  const ageRecaps = recaps.filter((recap) => recap.ageGroup === ageGroup);
  const onError = (error: unknown) => toast.error((error as Error).message);

  const setStatus = (fact: CastFact, status: CastFact["status"]) =>
    setFactStatus.mutate({ castId: cast.id, factId: fact.id, status }, { onError });

  const handleAddFact = () => addFact.mutate(
    { castId: cast.id, fact: { ageGroup, weekNumber: Number(newFact.weekNumber), text: newFact.text } },
    { onSuccess: () => setNewFact({ weekNumber: "", text: "" }), onError },
  );

  const handleAudit = (recap: WeekRecap) => audit.mutate(
    { castId: cast.id, ageGroup, weekNumber: recap.weekNumber },
    { onSuccess: () => toast.success(t("framed.memory.audited", { week: String(recap.weekNumber) })), onError },
  );

  // Rewrites days of a week in place: the drifting ones (the findings of the audit given to the AI), or every day
  const rewrite = (recap: WeekRecap, days: string[]) => create.mutate({
    mode: "framed", castId: cast.id, weeks: [recap.weekNumber], ages: [ageGroup], day: "Toute la semaine",
    regenerate: true, regenerateDays: days, fixDrift: days.length > 0, skipExisting: true, audit: true,
  }, {
    onSuccess: (job) => { toast.success(t("generation.form.launched")); onJobCreated(job.id); },
    onError,
  });

  return (
    <div className="space-y-6">
      {cast.ageGroups.length > 1 && (
        <div className="max-w-xs space-y-1">
          <Label htmlFor="memory-age">{t("create.generate.age")}</Label>
          <select id="memory-age" className={selectClass} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            {cast.ageGroups.map((age) => <option key={age} value={age}>{t(`ages.${age}`)}</option>)}
          </select>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-semibold">{t("framed.memory.facts")}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("framed.memory.factsHint")}</p>
        {ageFacts.length === 0 && <p className="text-sm text-gray-500">{t("framed.memory.noFacts")}</p>}
        <ul className="space-y-2">
          {ageFacts.map((fact) => (
            <li key={fact.id} className={`flex items-center gap-2 rounded-md border p-2 text-sm ${fact.status === "rejected" ? "opacity-50 line-through" : ""}`}>
              <Badge variant="outline">{t("timeline.weekNumber", { number: fact.weekNumber })}</Badge>
              <span className="flex-1">{fact.text}</span>
              <Badge variant="outline" className="border-0">{t(`framed.memory.factStatus.${fact.status}`)}</Badge>
              {fact.status !== "approved" && (
                <Button size="icon" variant="ghost" aria-label={t("framed.memory.approve")} title={t("framed.memory.approve")} onClick={() => setStatus(fact, "approved")}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
              )}
              {fact.status === "proposed" && (
                <Button size="icon" variant="ghost" aria-label={t("framed.memory.reject")} title={t("framed.memory.reject")} onClick={() => setStatus(fact, "rejected")}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              )}
              <Button size="icon" variant="ghost" aria-label={t("common.delete")} title={t("common.delete")}
                onClick={() => removeFact.mutate({ castId: cast.id, factId: fact.id }, { onError })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-28 space-y-1">
            <Label htmlFor="fact-week">{t("generation.detail.week")}</Label>
            <Input id="fact-week" type="number" min="1" max="53" value={newFact.weekNumber}
              onChange={(e) => setNewFact({ ...newFact, weekNumber: e.target.value })} />
          </div>
          <div className="min-w-[240px] flex-1 space-y-1">
            <Label htmlFor="fact-text">{t("framed.memory.newFact")}</Label>
            <Input id="fact-text" value={newFact.text} placeholder={t("framed.memory.newFactPlaceholder")}
              onChange={(e) => setNewFact({ ...newFact, text: e.target.value })} />
          </div>
          <Button type="button" variant="outline" className="gap-1" onClick={handleAddFact}
            disabled={!newFact.text.trim() || !newFact.weekNumber || addFact.isPending}>
            <Plus className="h-4 w-4" /> {t("framed.memory.addFact")}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t("framed.memory.weeks")}</h3>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
        {!isLoading && ageRecaps.length === 0 && <p className="text-sm text-gray-500">{t("framed.memory.noWeeks")}</p>}
        <ul className="space-y-3">
          {ageRecaps.map((recap) => {
            const issues = recap.audit?.issues ?? [];
            const days = driftingDays(recap);
            const outdated = recap.audit?.castVersion !== undefined && recap.audit.castVersion < cast.version;
            return (
              <li key={recap.weekNumber} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t("timeline.weekNumber", { number: recap.weekNumber })}</span>
                  {recap.audit && <Badge variant="outline">{t(`framed.memory.auditStatus.${recap.audit.status}`)}</Badge>}
                  {recap.stale && <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{t("framed.memory.stale")}</Badge>}
                  {outdated && <Badge variant="outline" className="border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{t("framed.memory.outdated")}</Badge>}
                  <span className="text-xs text-gray-500">{t("framed.memory.issueCount", { count: String(issues.length) })}</span>
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => handleAudit(recap)} disabled={audit.isPending}>
                      <RefreshCw className="h-4 w-4" /> {t("framed.memory.auditAgain")}
                    </Button>
                    {days.length > 0 && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => rewrite(recap, days)} disabled={create.isPending}>
                        <Wand2 className="h-4 w-4" /> {t("framed.memory.fixDays", { count: String(days.length) })}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1" disabled={create.isPending}
                      onClick={() => window.confirm(t("framed.memory.rewriteWeekConfirm", { week: String(recap.weekNumber) })) && rewrite(recap, [])}>
                      <Wand2 className="h-4 w-4" /> {t("framed.memory.rewriteWeek")}
                    </Button>
                  </div>
                </div>
                {recap.recap && <p className="text-sm text-gray-700 dark:text-gray-300">{recap.recap}</p>}
                {issues.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {issues.map((issue, i) => (
                      <li key={i} className="flex flex-wrap items-start gap-2">
                        <Badge variant="outline" className={`border-0 ${SEVERITY_CLASS[issue.severity]}`}>{t(`framed.memory.severity.${issue.severity}`)}</Badge>
                        <span>
                          {issue.day && <strong>{issue.day} · </strong>}
                          {issue.explanation}
                          {issue.quote && <em className="text-gray-500"> « {issue.quote} »</em>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {recap.audit?.note && <p className="text-xs text-gray-500">{recap.audit.note}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
