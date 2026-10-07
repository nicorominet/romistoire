import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { SeriesSelector } from "@/components/Story/SeriesSelector";
import { Series } from '@/types/Series';
import { MultiSelect } from "@/components/Common/MultiSelect";
import { AGE_GROUPS } from "@/types/Story";
import { ALL_WEEK, GENERATION_DAYS_FR } from "@/constants";
import { mapFrToEnDay } from "@/utils/dayUtils";

interface GenerationFormProps {
    isGenerating: boolean;
    availableWeeklyThemes: any[];
    availableSeries: Series[];
    availableModels?: string[];
    seriesName: string;
    onSeriesNameChange: (name: string) => void;
    onGenerate: (config: any) => void;
}

export const GenerationForm = ({ 
    isGenerating, 
    availableWeeklyThemes, 
    availableSeries,
    availableModels = [],
    seriesName,
    onSeriesNameChange,
    onGenerate 
}: GenerationFormProps) => {
    const { t } = i18n;

    const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
    const [selectedAgeRanges, setSelectedAgeRanges] = useState<string[]>(["4-6"]);
    const [dayOfWeek, setDayOfWeek] = useState("");
    const [numCharacters, setNumCharacters] = useState("");
    const [characterNames, setCharacterNames] = useState("");
    const [aiProvider, setAiProvider] = useState("gemini");
    const [aiModel, setAiModel] = useState("");

    const handleGenerateClick = () => {
        onGenerate({
            selectedWeeks,
            selectedAgeRanges,
            dayOfWeek,
            numCharacters,
            characterNames,
            aiProvider,
            aiModel
        });
    };

    const multiSelectLabels = {
        selectedLabel: (count: number) => t("create.generate.selectedCount", { count: String(count) }),
        selectAllLabel: t("create.generate.selectAll"),
        clearLabel: t("create.generate.clearSelection"),
    };

    // This form is rendered inside the manual story <form>: pressing Enter in an input
    // must not submit the manual form.
    const preventEnterSubmit = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
        }
    };

    return (
        <div className="space-y-4" onKeyDown={preventEnterSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="gen-week-select">{t("create.generate.projectWeek")}</Label>
                    <MultiSelect
                        id="gen-week-select"
                        options={availableWeeklyThemes.map((wt: any) => ({
                            value: String(wt.week_number),
                            label: `${t("timeline.weekNumber", { number: wt.week_number })} - ${wt.theme_name}`
                        }))}
                        value={selectedWeeks}
                        onChange={setSelectedWeeks}
                        placeholder={t("create.generate.selectWeeks")}
                        disabled={isGenerating}
                        {...multiSelectLabels}
                    />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <Label>{t("story.series")}</Label>
                    <SeriesSelector
                      series={availableSeries}
                      value={seriesName}
                      onChange={onSeriesNameChange}
                    />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ai-provider">{t("create.generate.aiProvider")}</Label>
                    <select 
                        id="ai-provider"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={aiProvider}
                        onChange={(e) => setAiProvider(e.target.value)}
                    >
                        <option value="gemini">{t("create.generate.provider.gemini")}</option>
                        <option value="local">{t("create.generate.provider.local")}</option>
                    </select>
                </div>
                
                {aiProvider === 'local' && (
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="ai-model">{t("create.generate.aiModel")}</Label>
                         <select 
                            id="ai-model"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                        >
                            <option value="">{t("create.generate.model.default")}</option>
                            {availableModels.map((model) => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="gen-age">{t("create.generate.age")}</Label>
                    <MultiSelect
                        id="gen-age"
                        options={AGE_GROUPS.map(age => ({ value: age, label: t(`ages.${age}`) }))}
                        value={selectedAgeRanges}
                        onChange={setSelectedAgeRanges}
                        placeholder={t("create.generate.selectAges")}
                        disabled={isGenerating}
                        {...multiSelectLabels}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="gen-day">{t("create.generate.day")}</Label>
                    <select 
                        id="gen-day"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value)}
                    >
                        <option value="">{t("create.selectDayOfWeek")}</option>
                        {/* Values are the French day names expected by the prompt; labels follow the UI language */}
                        {GENERATION_DAYS_FR.map(day => (
                            <option key={day} value={day}>{t(`days.${mapFrToEnDay(day).toLowerCase()}`)}</option>
                        ))}
                        <option value={ALL_WEEK}>{t("create.generate.allWeek")}</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="gen-num-chars">{t("create.generate.numCharacters")}</Label>
                    <Input 
                        id="gen-num-chars" 
                        type="number"
                        min="0"
                        placeholder={t('create.generate.numCharactersPlaceholder')} 
                        value={numCharacters}
                        onChange={(e) => setNumCharacters(e.target.value)}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="gen-char-names">{t("create.generate.charNames")}</Label>
                    <Input 
                        id="gen-char-names" 
                        placeholder={t('create.generate.charNamesPlaceholder')} 
                        value={characterNames}
                        onChange={(e) => setCharacterNames(e.target.value)}
                    />
                </div>
            </div>

            <Button 
                type="button"
                onClick={handleGenerateClick} 
                disabled={isGenerating} 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("create.generate.loading")}
                    </>
                ) : (
                    <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        {t("create.generate.button")}
                    </>
                )}
            </Button>
        </div>
    );
};
