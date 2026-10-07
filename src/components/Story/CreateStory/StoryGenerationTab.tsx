import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { i18n } from "@/lib/i18n";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/constants";
import { getDayLabel } from "@/utils/dayUtils";
import { useSeries } from "@/hooks/useSeries";
import { useStoryGeneration, GenerationReport } from "@/hooks/useStoryGeneration";
import { GenerationForm } from "./GenerationForm";
import { GenerationLog } from "./GenerationLog";
import { Series } from "@/types/Series";

interface StoryGenerationTabProps {
  onStoryGenerated?: (report: GenerationReport) => void;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

const StoryGenerationTab = ({ onStoryGenerated, onGeneratingChange }: StoryGenerationTabProps) => {
  const { t } = i18n;
  const [seriesName, setSeriesName] = useState("");

  const { data: availableSeries = [] } = useSeries();
  
  const { 
    isGenerating, 
    generationLog, 
    progress,
    report,
    handleGenerate,
    availableWeeklyThemes,
    availableModels
  } = useStoryGeneration({ 
    onStoryGenerated, 
    seriesName 
  });

  useEffect(() => {
    onGeneratingChange?.(isGenerating);
  }, [isGenerating, onGeneratingChange]);

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t("create.generate.title")}</h3>
        <p className="text-sm text-gray-500">
          {t("create.generate.subtitle")}
        </p>

        <GenerationForm 
          isGenerating={isGenerating}
          availableWeeklyThemes={availableWeeklyThemes}
          availableSeries={availableSeries as Series[]}
          availableModels={availableModels}
          seriesName={seriesName}
          onSeriesNameChange={setSeriesName}
          onGenerate={handleGenerate}
        />

        {(isGenerating || report) && (
          <div className="space-y-1" aria-live="polite">
            <Progress value={progress} className="h-2" aria-label={t("create.generate.progress")} />
            <p className="text-xs text-gray-500 text-right">{Math.round(progress)} %</p>
          </div>
        )}

        <GenerationLog logs={generationLog} />

        {report && report.created.length > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-4 space-y-3">
            <h4 className="font-semibold text-green-800 dark:text-green-300">
              {t("create.generate.report.title", { count: String(report.created.length) })}
            </h4>
            {(report.failed > 0 || report.skipped > 0) && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("create.generate.report.issues", { failed: String(report.failed), skipped: String(report.skipped) })}
              </p>
            )}
            <ul className="space-y-1 max-h-60 overflow-y-auto">
              {report.created.map(story => (
                <li key={story.id} className="text-sm">
                  <Link to={APP_ROUTES.STORY_DETAIL(story.id)} className="text-story-purple-700 dark:text-story-purple-300 hover:underline">
                    {story.title}
                  </Link>
                  <span className="text-gray-500">
                    {" "}— {t("timeline.weekNumber", { number: story.week })}, {getDayLabel(story.day)}, {t("ages." + story.age)}
                  </span>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to={APP_ROUTES.STORIES}>{t("create.generate.report.openLibrary")}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryGenerationTab;
