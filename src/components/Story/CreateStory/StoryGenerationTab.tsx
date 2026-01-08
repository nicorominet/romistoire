import React, { useState } from "react";
import { i18n } from "@/lib/i18n";
import { useSeries } from "@/hooks/useSeries";
import { useStoryGeneration } from "@/hooks/useStoryGeneration";
import { GenerationForm } from "./GenerationForm";
import { GenerationLog } from "./GenerationLog";
import { Series } from "@/types/Series";

interface StoryGenerationTabProps {
  onStoryGenerated: () => void;
}

const StoryGenerationTab = ({ onStoryGenerated }: StoryGenerationTabProps) => {
  const { t } = i18n;
  const [seriesName, setSeriesName] = useState("");

  const { data: availableSeries = [] } = useSeries();
  
  const { 
    isGenerating, 
    generationLog, 
    handleGenerate,
    availableWeeklyThemes 
  } = useStoryGeneration({ 
    onStoryGenerated, 
    seriesName 
  });

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
          seriesName={seriesName}
          onSeriesNameChange={setSeriesName}
          onGenerate={handleGenerate}
        />

        <GenerationLog logs={generationLog} />
      </div>
    </div>
  );
};

export default StoryGenerationTab;
