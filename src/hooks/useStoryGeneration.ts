import { useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { useStoryMutations } from "@/hooks/useStory";
import { useThemes, useWeeklyThemes, useThemeMutations } from "@/hooks/useThemes";
import { splitStorySegments, parseStorySegment, ParsedStory } from "@/utils/storyParser";
import { mapFrToEnDay } from "@/utils/dayUtils";
import { ALL_WEEK, GENERATION_DAYS_FR, GENERATION_LOCALE } from "@/constants";
import client from "@/api/client";
import { Theme, WeeklyTheme } from "@/types/Theme";
import { findSimilarThemes } from "@/utils/themeName";
import { parseHexColor } from "@/utils/themeColors";
import {
    buildDayParams, countWords, emptyWeekContext, isIterativeGeneration, isShortStory, missingWeekStories, pacingDelay, storyEnding, storyOpening,
    WEEK_STORY_COUNT, WrittenDay, CharacterSheet
} from "@/utils/generationPlan";

/** A story returned as structured JSON by the server (see server/services/helpers/story_output.helper.js). */
interface StructuredStory {
    day: string | null;
    title: string;
    summary: string;
    themes: { name: string; description?: string; icon?: string; color?: string }[];
    paragraphs: string[];
    illustrationPrompt: string;
}

interface GenerationResult {
    text: string;
    model?: string;
    truncated?: boolean;
    stories?: StructuredStory[] | null;
    /** Length asked for the age group */
    targetWords?: { min: number; max: number };
    /** Plan of the week and character sheets, returned by the first day of a week generated day by day */
    weekPlan?: string[] | null;
    characters?: CharacterSheet[] | null;
}

interface GeneratedStory extends ParsedStory {
    summary?: string;
}

export interface CreatedStorySummary {
    id: string;
    title: string;
    day: string;
    age: string;
    week: string;
}

export interface GenerationReport {
    created: CreatedStorySummary[];
    failed: number;
    skipped: number;
}

interface UseStoryGenerationProps {
    onStoryGenerated?: (report: GenerationReport) => void;
    seriesName: string;
}

const escapeHtml = (text: string) => text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const errorMessage = (error: unknown) =>
    (error as any)?.response?.data?.error || (error as Error)?.message || String(error);

/** Converts a structured story into the shape used by the text parser. Paragraphs become editor HTML. */
const fromStructured = (story: StructuredStory): GeneratedStory => ({
    title: story.title || i18n.t("create.generate.untitled"),
    content: story.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join(""),
    associatedThemes: story.themes,
    dayOfWeek: story.day || undefined,
    illustrationDescription: story.illustrationPrompt,
    summary: story.summary
});

export const useStoryGeneration = ({ onStoryGenerated, seriesName }: UseStoryGenerationProps) => {
    const { t } = i18n;
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationLog, setGenerationLog] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [report, setReport] = useState<GenerationReport | null>(null);

    const { data: availableThemes = [] } = useThemes();
    const { data: availableWeeklyThemes = [] } = useWeeklyThemes();
    const { createTheme } = useThemeMutations();
    const { generateAI, createStory } = useStoryMutations();

    // Themes created during the current run (the themes query is not refreshed between stories)
    const createdThemesRef = useRef<Map<string, Theme>>(new Map());
    // Start time of the previous cloud request (rate limit of the free tier)
    const lastCloudCallRef = useRef<number | null>(null);

    // Fetch local models
    const { data: availableModels = [] } = useQuery({
        queryKey: ["ollama-models"],
        queryFn: async () => {
             const res = await client.get<{models: string[]}>("/api/generate/ollama/models");
             return res.models || [];
        },
        retry: false,
        staleTime: 60000 // 1 minute
    });

    const addToLog = (message: string) => {
        setGenerationLog(prev => [...prev, message]);
    };

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Existing theme with the same or a similar name ("Océans" == "l'océan"), or a new theme marked "to review".
     */
    const resolveTheme = async (themeData: { name: string; description?: string; color?: string; icon?: string }, source: 'ai' | 'manual' = 'ai') => {
        const name = (themeData.name || "").trim();
        if (!name) return null;
        const known = [...(availableThemes as Theme[]), ...createdThemesRef.current.values()];
        const existing = findSimilarThemes(name, known)[0];
        if (existing) return existing;

        try {
            const theme = await createTheme.mutateAsync({
                name,
                description: themeData.description || "",
                color: parseHexColor(themeData.color) ? themeData.color : undefined,
                icon: themeData.icon || null,
                source,
            });
            createdThemesRef.current.set(theme.id, theme);
            if (!theme.existing) addToLog(t("create.generate.logs.themeCreated", { name: theme.name }));
            return theme;
        } catch (e) {
            console.error("Error resolving theme", e);
            return null;
        }
    };

    /**
     * Story themes (tags) chosen by the AI, reused when similar; the first one is the primary theme.
     * The topic of the week is not a tag: it is used only when the AI returned no theme at all,
     * because a story needs at least one theme.
     */
    const resolveStoryThemes = async (story: GeneratedStory, week: WeeklyTheme | undefined) => {
        const themes: { id: string; isPrimary: boolean }[] = [];
        const add = (id: string | undefined) => {
            if (id && !themes.some(theme => theme.id === id)) themes.push({ id, isPrimary: themes.length === 0 });
        };

        for (const theme of story.associatedThemes || []) {
            add((await resolveTheme(theme))?.id);
        }
        if (themes.length === 0 && week?.theme_name) {
            addToLog(t("create.generate.logs.topicAsTheme", { name: week.theme_name }));
            add((await resolveTheme({ name: week.theme_name, description: week.theme_description }))?.id);
        }
        return themes;
    };

    const saveStoryToDb = async (story: GeneratedStory, week: WeeklyTheme | undefined, ageRange: string, weekNum: string, source: string) => {
        const themes = await resolveStoryThemes(story, week);
        if (themes.length === 0) {
            throw new Error(t("create.generate.logs.noThemesError"));
        }

        const mappedDay = mapFrToEnDay(story.dayOfWeek || "");

        const saved = await createStory.mutateAsync({
            title: story.title,
            content: story.content,
            themes,
            ageGroup: ageRange,
            locale: GENERATION_LOCALE,
            dayOfWeek: mappedDay || "Monday",
            weekNumber: parseInt(weekNum) || 1,
            seriesName: seriesName,
            source: source,
            illustrationPrompt: story.illustrationDescription || null,
            illustrations: []
        });

        if (saved?.aliasSeries) {
            addToLog(t("create.generate.logs.aliasCreated", { series: saved.aliasSeries.name, title: story.title }));
        }
        return saved;
    };

    /** Turns the AI answer into stories: structured JSON when available, text parser otherwise. */
    const toStories = (result: GenerationResult, isWeek: boolean): GeneratedStory[] => {
        if (result.stories && result.stories.length > 0) {
            return result.stories.map(fromStructured);
        }
        addToLog(t("create.generate.logs.textFallback"));
        return splitStorySegments(result.text, isWeek).map(parseStorySegment);
    };

    /**
     * Generates and saves the stories of one request.
     * @returns The stories created, the last saved story as context for the next day, and the plan of the week (first day).
     */
    const generateAndProcess = async (params: any, weekNum: string, age: string, day: string, week: WeeklyTheme, source: string) => {
        const isWeek = day === ALL_WEEK;
        if (params.aiProvider !== "local") {
            const delay = pacingDelay(lastCloudCallRef.current, Date.now());
            if (delay > 0) {
                addToLog(t("create.generate.logs.pacing", { seconds: String(Math.ceil(delay / 1000)) }));
                await wait(delay);
            }
            lastCloudCallRef.current = Date.now();
        }
        const result = await generateAI.mutateAsync(params) as GenerationResult;
        if (result.truncated) {
            addToLog(t("create.generate.logs.truncated", { model: result.model || params.aiProvider }));
        }

        const created: CreatedStorySummary[] = [];
        let skipped = 0;
        let failed = 0;
        let lastDay: WrittenDay | null = null;

        for (const story of toStories(result, isWeek)) {
            // A weekly answer without a day cannot be placed: tell the user instead of dropping it silently
            if (isWeek && !story.dayOfWeek) {
                if (story.content) {
                    addToLog(t("create.generate.logs.segmentWithoutDay", { title: story.title }));
                    skipped++;
                }
                continue;
            }

            const finalStory = { ...story, dayOfWeek: isWeek ? story.dayOfWeek : (story.dayOfWeek || day) };
            const words = countWords(story.content || "");
            if (isShortStory(words, result.targetWords)) {
                addToLog(t("create.generate.logs.shortStory", {
                    title: finalStory.title, words: String(words),
                    min: String(result.targetWords!.min), max: String(result.targetWords!.max)
                }));
            }
            try {
                const saved = await saveStoryToDb(finalStory, week, age, weekNum, source);
                addToLog(`✅ ${t("create.generate.logs.saved", { title: finalStory.title, age: t("ages." + age), day: finalStory.dayOfWeek || "" })}`);
                created.push({ id: saved?.id, title: finalStory.title, day: finalStory.dayOfWeek || "", age, week: weekNum });
                lastDay = {
                    day: isWeek ? (finalStory.dayOfWeek || day) : day,
                    title: finalStory.title,
                    summary: story.summary || "",
                    ending: storyEnding(story.content || ""),
                    opening: storyOpening(story.content || ""),
                };
            } catch (error) {
                failed++;
                addToLog(t("create.generate.logs.error", { error: errorMessage(error) }));
            }
        }
        return { created, skipped, failed, lastDay, weekPlan: result.weekPlan ?? null, characters: result.characters ?? null };
    };

    const handleGenerate = async (config: {
        selectedWeeks: string[],
        selectedAgeRanges: string[],
        dayOfWeek: string,
        numCharacters: string,
        characterNames: string,
        aiProvider: string,
        aiModel?: string
    }) => {
        if (config.selectedWeeks.length === 0 || config.selectedAgeRanges.length === 0 || !config.dayOfWeek) {
            toast.error(t("create.generate.logs.selectRequired"));
            return;
        }

        setIsGenerating(true);
        setGenerationLog([]);
        setProgress(0);
        setReport(null);
        createdThemesRef.current = new Map();
        lastCloudCallRef.current = null;

        const source = config.aiProvider === 'local' ? 'ollama' : 'gemini';
        // A week is one request for young ages, day by day from 10-12 (and always with Ollama)
        const isIterative = (age: string) => isIterativeGeneration(config.dayOfWeek, age, config.aiProvider);
        const unitsFor = (age: string) => (isIterative(age) ? GENERATION_DAYS_FR.length : 1);
        const unitsPerWeek = config.selectedAgeRanges.reduce((total, age) => total + unitsFor(age), 0);
        const totalUnits = config.selectedWeeks.length * unitsPerWeek;
        let doneUnits = 0;
        const advance = (units = 1) => {
            doneUnits += units;
            setProgress(Math.min(100, (doneUnits / totalUnits) * 100));
        };

        const runReport: GenerationReport = { created: [], failed: 0, skipped: 0 };
        const collect = (outcome: { created: CreatedStorySummary[]; skipped: number; failed: number }) => {
            runReport.created.push(...outcome.created);
            runReport.skipped += outcome.skipped;
            runReport.failed += outcome.failed;
        };

        const baseParams = {
            numCharacters: config.numCharacters ? parseInt(config.numCharacters) : undefined,
            charNames: config.characterNames,
            seriesName: seriesName,
            aiProvider: config.aiProvider,
            model: config.aiModel || undefined
        };

        addToLog(t("create.generate.logs.start"));

        for (const weekNum of config.selectedWeeks) {
            const currentWeekTheme = (availableWeeklyThemes as WeeklyTheme[]).find((wt) => wt.week_number.toString() === weekNum);
            if (!currentWeekTheme) {
                addToLog(t("create.generate.logs.weekNotFound", { week: weekNum }));
                runReport.skipped += config.selectedAgeRanges.length;
                advance(unitsPerWeek);
                continue;
            }
            const themeName = currentWeekTheme.theme_name;
            // The topic of the week guides the writing; story tags are chosen by the AI
            // The week number gives the season of the story
            const topicParams = {
                theme: themeName,
                themeDescription: currentWeekTheme.theme_description || undefined,
                weekNumber: parseInt(weekNum, 10) || undefined,
            };

            for (const age of config.selectedAgeRanges) {
                if (isIterative(age)) {
                    // What the week knows so far: plan (from Monday), days written, last scene
                    const weekContext = emptyWeekContext();
                    for (const day of GENERATION_DAYS_FR) {
                        addToLog(t("create.generate.logs.generatingIterative", { week: weekNum, day: t(`days.${mapFrToEnDay(day).toLowerCase()}`), age: t("ages." + age) }));
                        try {
                            const outcome = await generateAndProcess({
                                ...baseParams, ...topicParams, age, day, ...buildDayParams(weekContext)
                            }, weekNum, age, day, currentWeekTheme, source);
                            collect(outcome);
                            if (outcome.weekPlan && !weekContext.weekPlan) {
                                weekContext.weekPlan = outcome.weekPlan;
                                addToLog(t("create.generate.logs.weekPlan"));
                            }
                            if (outcome.characters && !weekContext.characters) weekContext.characters = outcome.characters;
                            if (outcome.lastDay) weekContext.days.push(outcome.lastDay);
                        } catch (error) {
                            runReport.failed++;
                            addToLog(t("create.generate.logs.error", { error: errorMessage(error) }));
                        }
                        advance();
                    }
                } else {
                    addToLog(t("create.generate.logs.generating", { week: weekNum, theme: themeName, age: t("ages." + age) }));
                    try {
                        const outcome = await generateAndProcess({
                            ...baseParams, ...topicParams, age, day: config.dayOfWeek
                        }, weekNum, age, config.dayOfWeek, currentWeekTheme, source);
                        // A week in one request must give 7 stories: say so when some are missing
                        const missing = missingWeekStories(config.dayOfWeek, outcome.created.length + outcome.failed + outcome.skipped);
                        if (missing > 0) {
                            addToLog(t("create.generate.logs.incompleteWeek", { count: String(outcome.created.length), total: String(WEEK_STORY_COUNT) }));
                        }
                        collect({ ...outcome, failed: outcome.failed + missing });
                    } catch (error) {
                        // One failing request must not cancel the remaining weeks and ages
                        runReport.failed++;
                        addToLog(t("create.generate.logs.error", { error: errorMessage(error) }));
                    }
                    advance();
                }
            }
        }

        setProgress(100);
        setReport(runReport);
        setIsGenerating(false);

        if (runReport.created.length === 0) {
            addToLog(t("create.generate.logs.nothingCreated"));
            toast.error(t("create.generate.logs.nothingCreated"));
            return;
        }

        addToLog(t("create.generate.logs.summary", {
            created: String(runReport.created.length),
            failed: String(runReport.failed),
            skipped: String(runReport.skipped)
        }));
        onStoryGenerated?.(runReport);
    };

    return {
        isGenerating,
        generationLog,
        progress,
        report,
        handleGenerate,
        availableWeeklyThemes,
        availableModels
    };
};
