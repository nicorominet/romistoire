import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { AgeGroup, Story } from '@/types/Story';
import { Series } from '@/types/Series';
import { Theme } from '@/types/Theme';
import { SeriesSelector } from "@/components/Story/SeriesSelector";

// Hooks
import { useSeries } from "@/hooks/useSeries";
import { useThemes, useWeeklyThemes, useThemeMutations } from "@/hooks/useThemes";
import { useStoryMutations } from "@/hooks/useStory";

interface StoryGenerationTabProps {
  onStoryGenerated: () => void;
}

const StoryGenerationTab = ({ onStoryGenerated }: StoryGenerationTabProps) => {
  const { t } = i18n;
  
  const [weeklyTheme, setWeeklyTheme] = useState("");
  const [selectedAgeRanges, setSelectedAgeRanges] = useState<string[]>(["4-6 ans"]);
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [weeklyNumber, setWeeklyNumber] = useState("");
  const [numCharacters, setNumCharacters] = useState("");
  const [characterNames, setCharacterNames] = useState("");
  const [seriesName, setSeriesName] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLog, setGenerationLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  // Hooks
  const { data: availableSeries = [] } = useSeries();
  const { data: availableThemes = [] } = useThemes();
  const { data: availableWeeklyThemes = [] } = useWeeklyThemes();
  const { createTheme } = useThemeMutations();
  const { generateAI, createStory } = useStoryMutations();

  const handleAgeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const options = e.target.options;
      const values: string[] = [];
      for (let i = 0, l = options.length; i < l; i++) {
          if (options[i].selected) {
              values.push(options[i].value);
          }
      }
      setSelectedAgeRanges(values);
  };

  const addToLog = (message: string) => {
      setGenerationLog(prev => [...prev, message]);
  };

  const resolveTheme = async (themeData: any) => {
      try {
          // Check if exists in availableThemes (cache)
          const existing = availableThemes.find((t: any) => t.name.toLowerCase() === themeData.name.toLowerCase());
          if (existing) return existing;

          // Create new
          const newTheme = await createTheme.mutateAsync({
              name: themeData.name,
              description: themeData.description,
              color: themeData.color,
              // icon: themeData.icon // backend doesn't seem to support icon in schema? ignored if not
          });
          return newTheme;
      } catch (e) {
          console.error("Error resolving theme", e);
      }
      return null;
  };

  const saveStoryToDb = async (story: any, ageRange: string) => {
      // 1. Resolve Themes
      const themeIds = [];
      if (story.associatedThemes && story.associatedThemes.length > 0) {
          for (const theme of story.associatedThemes) {
              const savedTheme = await resolveTheme(theme);
              if (savedTheme) themeIds.push({ id: savedTheme.id });
          }
      }
      
      // Fallback
      if (themeIds.length === 0 && story.weeklyThemeName) {
           const fallbackTheme = await resolveTheme({ 
               name: story.weeklyThemeName, 
               description: "Thème hebdomadaire auto-généré",
               color: "#6366f1", 
           });
           if (fallbackTheme) themeIds.push({ id: fallbackTheme.id });
      }

      if (themeIds.length === 0) {
          console.error("No themes found for story, cannot save.");
          throw new Error("Impossible de sauvegarder l'histoire sans thème (Erreur de parsing IA).");
      }
      
      // 2. Prepare Story Payload
      let mappedDay = story.dayOfWeek;
      const dayMap: Record<string, string> = { "Lundi": "Monday", "Mardi": "Tuesday", "Mercredi": "Wednesday", "Jeudi": "Thursday", "Vendredi": "Friday", "Samedi": "Saturday", "Dimanche": "Sunday" };
      if (dayMap[mappedDay]) mappedDay = dayMap[mappedDay];

      const payload = {
          title: story.title,
          content: story.content,
          themes: themeIds,
          ageGroup: ageRange.replace(" ans", ""),
          locale: "fr",
          dayOfWeek: mappedDay === "Toute la semaine" ? "Monday" : mappedDay, 
          weekNumber: parseInt(weeklyNumber) || 1,
          seriesName: seriesName, 
          illustrations: [] // Illustrations are empty initially for AI stories? Or generated? Protocol says illustrations separate?
          // The parsing logic extracted illustration description but didn't generate image.
      };

      // 3. Save via Mutation
      await createStory.mutateAsync(payload);
  };

  const parseAndSaveStories = async (rawText: string, ageRange: string, day: string) => {
      let storySegments = [];
      if (day === "Toute la semaine") {
          storySegments = rawText.split(/(?=\*\*Titre de l'Histoire :)/g).filter(s => s.trim() !== '');
      } else {
          storySegments = [rawText];
      }

      for (const segment of storySegments) {
            const titleMatch = segment.match(/\*\*Titre de l'Histoire :\*\* (.*?)(\n|$)/);
            const storyTitle = titleMatch ? titleMatch[1].trim() : "Histoire Générée";
            
            let associatedThemesData: any[] = [];
            let themesJsonStringForRemoval = ''; 
            
            const themesJsonHeaderRegex = /\*\*Thèmes Associés \(JSON\):\*\*/;
            const jsonBlockRegex = /(\[[\s\S]*?\])/;
            
            const headerMatch = segment.match(themesJsonHeaderRegex);
            if (headerMatch) {
                const textAfterHeader = segment.substring(headerMatch.index! + headerMatch[0].length);
                const jsonMatch = textAfterHeader.match(jsonBlockRegex);
                
                if (jsonMatch) {
                    try {
                        associatedThemesData = JSON.parse(jsonMatch[1]);
                        const exactStringMatch = segment.match(new RegExp(`\\*\\*Thèmes Associés \\(JSON\\):\\*\\*[\\s\\S]*?${jsonMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
                        if (exactStringMatch) {
                           themesJsonStringForRemoval = exactStringMatch[0];
                        }
                    } catch (e) {
                        console.warn("Failed to parse themes JSON", e);
                    }
                }
            }

            if (associatedThemesData.length === 0) {
                 const themesTextRegex = /\*\*Thèmes Associés :\*\* (.*?)(\n|$)/;
                 const themesTextMatch = segment.match(themesTextRegex);
                 if (themesTextMatch) {
                    associatedThemesData = themesTextMatch[1].split(',').map(t => ({ name: t.trim() })).filter(t => t.name !== '');
                    themesJsonStringForRemoval = themesTextMatch[0];
                 }
            }

             const illustrationRegex = /\[Illustration: (.*?)\]/s;
             const illustrationMatch = segment.match(illustrationRegex);
             const illustrationDescription = illustrationMatch ? illustrationMatch[1].trim() : '';
             const illustrationLineForRemoval = illustrationMatch ? illustrationMatch[0] : '';

             const ageRangeLineMatch = segment.match(/\*\*Tranche d'Âge :\*\* (.*?)(\n|$)/);
             const weeklyThemeLineMatch = segment.match(/\*\*Thème Hebdomadaire :\*\* (.*?)(\n|$)/);
             const dayOfWeekLineMatch = segment.match(/\*\*Jour de la Semaine :\*\* (.*?)(\n|$)/);

            let storyContent = segment;
            if (titleMatch) storyContent = storyContent.replace(titleMatch[0], '');
            if (weeklyThemeLineMatch) storyContent = storyContent.replace(weeklyThemeLineMatch[0], '');
            if (ageRangeLineMatch) storyContent = storyContent.replace(ageRangeLineMatch[0], '');
            if (dayOfWeekLineMatch) storyContent = storyContent.replace(dayOfWeekLineMatch[0], '');
            if (themesJsonStringForRemoval) storyContent = storyContent.replace(themesJsonStringForRemoval, '');
            storyContent = storyContent.replace(illustrationLineForRemoval, '');
            
            if (illustrationDescription) {
                storyContent += `\n\n> **Illustration suggérée :** ${illustrationDescription}`;
            }

            storyContent = storyContent.trim();

             const actualDay = (day === "Toute la semaine" && dayOfWeekLineMatch) ? dayOfWeekLineMatch[1].trim() : day;

            if (day === "Toute la semaine" && !dayOfWeekLineMatch) {
                continue;
            }

            const storyObj = {
                title: storyTitle,
                content: storyContent,
                associatedThemes: associatedThemesData,
                dayOfWeek: actualDay,
                weeklyThemeName: weeklyTheme 
            };

            await saveStoryToDb(storyObj, ageRange);
            addToLog(`✅ Histoire créée : "${storyTitle}" (${ageRange} - ${actualDay})`);
      }
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleGenerate = async () => {
    if (!weeklyTheme || selectedAgeRanges.length === 0 || !dayOfWeek) {
        toast.error("Veuillez remplir le thème, au moins une tranche d'âge et le jour.");
        return;
    }

    setIsGenerating(true);
    setGenerationLog([]);
    setProgress(0);
    const totalSteps = selectedAgeRanges.length;
    let completedSteps = 0;

    try {
      addToLog("🚀 Démarrage de la génération...");

      for (const age of selectedAgeRanges) {
          addToLog(`⏳ Génération pour ${age}...`);
          
          // Use Mutation (must allow generic POST? useStoryMutations has generateAI)
          // generateAI in hooks returns promise if using mutateAsync
          // But my hook uses `client.post`.
          
          const result = await generateAI.mutateAsync({
             theme: weeklyTheme,
             age: age,
             day: dayOfWeek,
             numCharacters: numCharacters ? parseInt(numCharacters) : undefined,
             charNames: characterNames,
             seriesName: seriesName
          }) as any;
          
          // result.text is the response from backend
          const storyText = result.text;
          
          await parseAndSaveStories(storyText, age, dayOfWeek);
          
          completedSteps++;
          setProgress((completedSteps / totalSteps) * 100);

          if (completedSteps < totalSteps) {
              await wait(2000); 
          }
      }
      
      addToLog("✨ Génération terminée avec succès !");
      setTimeout(() => {
        onStoryGenerated();
      }, 2000);

    } catch (error) {
      console.error("Generation error:", error);
      addToLog(`❌ Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
      toast.error("Une erreur est survenue pendant la génération.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWeeklyThemeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === "") {
          setWeeklyNumber("");
          setWeeklyTheme("");
          return;
      }
      
      const selected = availableWeeklyThemes.find((t: any) => t.week_number.toString() === val);
      if (selected) {
          setWeeklyNumber(selected.week_number.toString());
          setWeeklyTheme(selected.theme_name);
      }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t("create.generate.title")}</h3>
        <p className="text-sm text-gray-500">
          {t("create.generate.subtitle")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
                <Label htmlFor="gen-week-select">Semaine du Projet</Label>
                <select 
                    id="gen-week-select"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={weeklyNumber}
                    onChange={handleWeeklyThemeSelect}
                >
                    <option value="">Sélectionner une semaine...</option>
                    {availableWeeklyThemes.map((wt: any) => (
                        <option key={wt.week_number} value={wt.week_number}>
                            Semaine {wt.week_number} - {wt.theme_name}
                        </option>
                    ))}
                </select>
                {weeklyTheme && (
                    <p className="text-sm text-gray-500 mt-1">
                        Thème sélectionné : <strong>{weeklyTheme}</strong>
                    </p>
                )}
            </div>

            <div className="space-y-2 md:col-span-2">
                <Label>{t("story.series")}</Label>
                <SeriesSelector
                  series={availableSeries as Series[]}
                  value={seriesName}
                  onChange={setSeriesName}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="gen-age">{t("create.generate.age")} (Maintenir Ctrl pour plusieurs)</Label>
                <select 
                    id="gen-age"
                    multiple
                    size={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedAgeRanges}
                    onChange={handleAgeRangeChange}
                >
                    <option value="2-3 ans">2-3 ans</option>
                    <option value="4-6 ans">4-6 ans</option>
                    <option value="7-9 ans">7-9 ans</option>
                    <option value="10-12 ans">10-12 ans</option>
                    <option value="13-15 ans">13-15 ans</option>
                    <option value="16-18 ans">16-18 ans</option>
                </select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="gen-day">{t("create.generate.day")}</Label>
                <select 
                    id="gen-day"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            onClick={handleGenerate} 
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

        {generationLog.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                <h4 className="font-semibold text-gray-700 mb-2">Historique d'exécution :</h4>
                <ul className="space-y-1">
                    {generationLog.map((log, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start">
                            {log.includes('✅') ? <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5" /> : <span className="mr-6"></span>}
                            {log}
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
};

export default StoryGenerationTab;
