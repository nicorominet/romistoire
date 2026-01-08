import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { SeriesSelector } from "@/components/Story/SeriesSelector";
import { Series } from '@/types/Series';

interface GenerationFormProps {
    isGenerating: boolean;
    availableWeeklyThemes: any[];
    availableSeries: Series[];
    seriesName: string;
    onSeriesNameChange: (name: string) => void;
    onGenerate: (config: any) => void;
}

export const GenerationForm = ({ 
    isGenerating, 
    availableWeeklyThemes, 
    availableSeries,
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

    const handleGenerateClick = () => {
        onGenerate({
            selectedWeeks,
            selectedAgeRanges,
            dayOfWeek,
            numCharacters,
            characterNames,
            aiProvider
        });
    };

    const handleWeeklyThemeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const values = Array.from(e.target.selectedOptions, option => option.value);
        setSelectedWeeks(values);
    };

    const handleAgeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const values = Array.from(e.target.selectedOptions, option => option.value);
        setSelectedAgeRanges(values);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="gen-week-select">{t("create.generate.projectWeek")} <span className="text-xs text-gray-500">{t("create.generate.holdCtrl")}</span></Label>
                    <select 
                        id="gen-week-select"
                        multiple
                        size={6}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedWeeks}
                        onChange={handleWeeklyThemeSelect}
                    >
                        {availableWeeklyThemes.map((wt: any) => (
                            <option key={wt.week_number} value={wt.week_number}>
                                {t("timeline.weekNumber", { number: wt.week_number })} - {wt.theme_name}
                            </option>
                        ))}
                    </select>
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

                <div className="space-y-2">
                    <Label htmlFor="gen-age">{t("create.generate.age")} <span className="text-xs text-gray-500">{t("create.generate.holdCtrl")}</span></Label>
                    <select 
                        id="gen-age"
                        multiple
                        size={4}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedAgeRanges}
                        onChange={handleAgeRangeChange}
                    >
                        <option value="2-3">{t("ages.2-3")}</option>
                        <option value="4-6">{t("ages.4-6")}</option>
                        <option value="7-9">{t("ages.7-9")}</option>
                        <option value="10-12">{t("ages.10-12")}</option>
                        <option value="13-15">{t("ages.13-15")}</option>
                        <option value="16-18">{t("ages.16-18")}</option>
                    </select>
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
                        <option value="Lundi">{t("days.monday")}</option>
                        <option value="Mardi">{t("days.tuesday")}</option>
                        <option value="Mercredi">{t("days.wednesday")}</option>
                        <option value="Jeudi">{t("days.thursday")}</option>
                        <option value="Vendredi">{t("days.friday")}</option>
                        <option value="Samedi">{t("days.saturday")}</option>
                        <option value="Dimanche">{t("days.sunday")}</option>
                        <option value="Toute la semaine">Toute la semaine</option>
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
