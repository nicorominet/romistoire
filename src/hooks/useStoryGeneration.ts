import { useState } from "react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { useStoryMutations } from "@/hooks/useStory";
import { useThemes, useWeeklyThemes, useThemeMutations } from "@/hooks/useThemes";
import { splitStorySegments, parseStorySegment } from "@/utils/storyParser";
import { mapFrToEnDay } from "@/utils/dayUtils";

interface UseStoryGenerationProps {
    onStoryGenerated: () => void;
    seriesName: string;
}

export const useStoryGeneration = ({ onStoryGenerated, seriesName }: UseStoryGenerationProps) => {
    const { t } = i18n;
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationLog, setGenerationLog] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    const { data: availableThemes = [] } = useThemes();
    const { data: availableWeeklyThemes = [] } = useWeeklyThemes();
    const { createTheme } = useThemeMutations();
    const { generateAI, createStory } = useStoryMutations();

    const addToLog = (message: string) => {
        setGenerationLog(prev => [...prev, message]);
    };

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const resolveTheme = async (themeData: any) => {
        try {
            const existing = (availableThemes as any[]).find((t: any) => t.name.toLowerCase() === themeData.name.toLowerCase());
            if (existing) return existing;

            const newTheme = await createTheme.mutateAsync({
                name: themeData.name,
                description: themeData.description,
                color: themeData.color || "#6366f1",
            });
            return newTheme;
        } catch (e) {
            console.error("Error resolving theme", e);
            return null;
        }
    };

    const saveStoryToDb = async (parsedStory: any, ageRange: string, weekNum: string, source: string) => {
        const themeIds = [];
        
        // Resolve Themes
        if (parsedStory.associatedThemes && parsedStory.associatedThemes.length > 0) {
            for (const theme of parsedStory.associatedThemes) {
                const savedTheme = await resolveTheme(theme);
                if (savedTheme) themeIds.push({ id: savedTheme.id });
                else console.warn(`Could not resolve theme: ${theme.name}`);
            }
        }
        
        // Fallback to weekly theme name if no themes parsed
        if (themeIds.length === 0 && parsedStory.weeklyThemeName) {
            const fallbackTheme = await resolveTheme({ 
                name: parsedStory.weeklyThemeName, 
                description: "Thème hebdomadaire auto-généré",
            });
            if (fallbackTheme) themeIds.push({ id: fallbackTheme.id });
        }

        if (themeIds.length === 0) {
            throw new Error(t("create.generate.logs.noThemesError") || "Impossible de sauvegarder l'histoire sans thème.");
        }
        
        const mappedDay = mapFrToEnDay(parsedStory.dayOfWeek);

        await createStory.mutateAsync({
            title: parsedStory.title,
            content: parsedStory.content,
            themes: themeIds,
            ageGroup: ageRange,
            locale: "fr",
            dayOfWeek: mappedDay === "Toute la semaine" ? "Monday" : (mappedDay || "Monday"), 
            weekNumber: parseInt(weekNum) || 1,
            seriesName: seriesName, 
            source: source,
            illustrations: [] 
        });
    };

    const generateAndProcess = async (params: any, weekNum: string, age: string, day: string, themeName: string, source: string) => {
        const result = await generateAI.mutateAsync(params) as any;
        const segments = splitStorySegments(result.text, day === "Toute la semaine");
        
        let lastContent = "";
        for (const segment of segments) {
            const parsed = parseStorySegment(segment);
            
            // Skip if no day info in weekly batch
            if (day === "Toute la semaine" && !parsed.dayOfWeek) continue;

            const finalStory = {
                ...parsed,
                dayOfWeek: parsed.dayOfWeek || day,
                weeklyThemeName: themeName
            };

            await saveStoryToDb(finalStory, age, weekNum, source);
            addToLog(t("create.generate.logs.success") + ` : "${parsed.title}" (${t("ages." + age)} - ${finalStory.dayOfWeek})`);
            lastContent = parsed.content;
        }
        return lastContent;
    };

    const handleGenerate = async (config: {
        selectedWeeks: string[],
        selectedAgeRanges: string[],
        dayOfWeek: string,
        numCharacters: string,
        characterNames: string,
        aiProvider: string
    }) => {
        if (config.selectedWeeks.length === 0 || config.selectedAgeRanges.length === 0 || !config.dayOfWeek) {
            toast.error(t("create.generate.logs.selectRequired"));
            return;
        }

        setIsGenerating(true);
        setGenerationLog([]);
        setProgress(0);
        
        const totalSteps = config.selectedWeeks.length * config.selectedAgeRanges.length;
        let completedSteps = 0;

        try {
            addToLog(t("create.generate.logs.start"));

            for (const weekNum of config.selectedWeeks) {
                const currentWeekTheme = (availableWeeklyThemes as any[]).find((t: any) => t.week_number.toString() === weekNum);
                if (!currentWeekTheme) {
                    addToLog(t("create.generate.logs.weekNotFound", { week: weekNum }));
                    continue;
                }
                const themeName = currentWeekTheme.theme_name;

                for (const age of config.selectedAgeRanges) {
                    const source = config.aiProvider === 'local' ? 'ollama' : 'gemini';
                    
                    if (config.dayOfWeek === "Toute la semaine" && config.aiProvider === "local") {
                        const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
                        let previousStoryContent = "";
                        for (const d of days) {
                            addToLog(t("create.generate.logs.generatingIterative", { week: weekNum, day: d, age: t("ages." + age) }));
                            try {
                                const lastContent = await generateAndProcess({
                                    theme: themeName,
                                    age: age,
                                    day: d,
                                    numCharacters: config.numCharacters ? parseInt(config.numCharacters) : undefined,
                                    charNames: config.characterNames,
                                    seriesName: seriesName,
                                    aiProvider: config.aiProvider,
                                    previousChapter: previousStoryContent,
                                    isIterative: true
                                }, weekNum, age, d, themeName, source);
                                if (lastContent) previousStoryContent = lastContent;
                            } catch (err) {
                                console.error(err);
                                addToLog(t("create.generate.logs.error", { error: err }));
                            }
                            await wait(500);
                        }
                    } else {
                        addToLog(t("create.generate.logs.generating", { week: weekNum, theme: themeName, age: t("ages." + age) }));
                        await generateAndProcess({
                            theme: themeName,
                            age: age,
                            day: config.dayOfWeek,
                            numCharacters: config.numCharacters ? parseInt(config.numCharacters) : undefined,
                            charNames: config.characterNames,
                            seriesName: seriesName,
                            aiProvider: config.aiProvider
                        }, weekNum, age, config.dayOfWeek, themeName, source);
                    }
                    
                    completedSteps++;
                    setProgress((completedSteps / totalSteps) * 100);
                }
            }
            
            addToLog(t("create.generate.logs.success"));
            setTimeout(() => {
                onStoryGenerated();
            }, 2000);

        } catch (error: any) {
            console.error("Generation error:", error);
            addToLog(t("create.generate.logs.error", { error: error.message || "Erreur inconnue" }));
            toast.error(t("create.generate.logs.errorGeneric"));
        } finally {
            setIsGenerating(false);
        }
    };

    return {
        isGenerating,
        generationLog,
        progress,
        handleGenerate,
        availableWeeklyThemes
    };
};
