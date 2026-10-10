import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, CheckCircle2, Info, Loader2, Plug, Plus, RotateCcw, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAppSettings } from "@/hooks/useAppSettings";
import { settingsApi } from "@/api/settings.api";
import { AiProvider, AppSettingsResponse, AppSettingsUpdate, OllamaTestResult } from "@/types/system.types";
import { QuotaUsageCard } from "./QuotaUsageCard";
import { VoiceDraft, VoiceOptionsFields, voiceDraftFrom } from "./VoiceOptionsFields";
import { AI_TIMEOUT_LIMITS_SECONDS, AiTimeoutKey, isValidAiTimeoutSeconds } from "@/utils/settingsValidation";

const DEFAULT_CREATIVITY = 0.9;
const MODEL_NAME_RE = /^[\w.:\-/]+$/;

/** Seconds shown in the inputs, milliseconds stored on the server. Empty input = not set. */
const toSeconds = (ms: number | null) => (ms === null ? "" : String(Math.round(ms / 1000)));
const toMs = (seconds: string) => (seconds.trim() === "" ? null : Math.round(Number(seconds) * 1000));

interface ModelListEditorProps {
  id: string;
  label: string;
  /** Models in use (saved list, or the .env / code default). */
  models: string[];
  /** True when the list comes from the settings page (else .env / code default). */
  isCustom: boolean;
  saving: boolean;
  onSave: (models: string[] | null) => void;
}

/**
 * Ordered list of Gemini models: the first one is tried first, the next ones are fallbacks.
 */
const ModelListEditor = ({ id, label, models, isCustom, saving, onSave }: ModelListEditorProps) => {
  const { t } = i18n;
  const [draft, setDraft] = useState<string[]>(models);
  const [newModel, setNewModel] = useState("");
  const changed = draft.join(",") !== models.join(",");

  useEffect(() => {
    if (!changed) setDraft(models);
  }, [models, changed]);

  const move = (index: number, delta: number) => {
    const next = [...draft];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setDraft(next);
  };
  const add = () => {
    const name = newModel.trim();
    if (!name || !MODEL_NAME_RE.test(name) || draft.includes(name)) return;
    setDraft([...draft, name]);
    setNewModel("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-new`}>{label}</Label>
        <Badge variant="outline">{isCustom ? t("settings.ai.custom") : t("settings.ai.fromEnv")}</Badge>
      </div>
      <ol className="space-y-1">
        {draft.map((model, index) => (
          <li key={model} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm font-mono">
            <span className="w-5 text-right text-gray-400">{index + 1}.</span>
            <span className="flex-1 truncate">{model}</span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("settings.ai.moveUp")}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === draft.length - 1} onClick={() => move(index, 1)} aria-label={t("settings.ai.moveDown")}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={draft.length === 1} onClick={() => setDraft(draft.filter((m) => m !== model))} aria-label={t("settings.ai.remove")}>
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Input
          id={`${id}-new`}
          value={newModel}
          onChange={(e) => setNewModel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={t("settings.ai.addModelPlaceholder")}
          className="font-mono text-sm"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!MODEL_NAME_RE.test(newModel.trim())}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!changed || saving} onClick={() => onSave(draft)}>
          {t("common.save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!isCustom || saving} onClick={() => onSave(null)} className="gap-1">
          <RotateCcw className="h-3 w-3" /> {t("settings.ai.restoreEnv")}
        </Button>
      </div>
    </div>
  );
};

/**
 * AiSettings Component
 *
 * Settings > AI generation: default provider, Gemini models, reading voice, Ollama instance, creativity and timeouts.
 * Saved on the server; a cleared value goes back to the .env configuration.
 */
export const AiSettings = () => {
  const { t } = i18n;
  const { data, isLoading, isError, update } = useAppSettings();
  const aiStatus = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => settingsApi.getAiStatus(),
    refetchInterval: 30000,
  });

  // Ollama form (saved together)
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaTest, setOllamaTest] = useState<OllamaTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  // Timeouts form, in seconds
  const [timeouts, setTimeouts] = useState({ gemini: "", geminiWeek: "", ollama: "" });
  const [creativity, setCreativity] = useState(DEFAULT_CREATIVITY);
  const [ollamaDirty, setOllamaDirty] = useState(false);
  const [timeoutsDirty, setTimeoutsDirty] = useState(false);
  const [creativityDirty, setCreativityDirty] = useState(false);
  // Reading voice form (saved together)
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [voiceDirty, setVoiceDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (!ollamaDirty) {
      setOllamaUrl(data.effective.ollamaBaseUrl);
      setOllamaModel(data.effective.ollamaModel);
    }
    if (!timeoutsDirty) {
      setTimeouts({
        gemini: toSeconds(data.settings.ai.geminiTimeoutMs),
        geminiWeek: toSeconds(data.settings.ai.geminiWeekTimeoutMs),
        ollama: toSeconds(data.settings.ai.ollamaTimeoutMs),
      });
    }
    if (!creativityDirty) setCreativity(data.settings.ai.creativity ?? DEFAULT_CREATIVITY);
    if (!voiceDirty) setVoiceDraft(voiceDraftFrom(data.settings.ai.audio, data.audioOptions.defaults));
  }, [data, ollamaDirty, timeoutsDirty, creativityDirty, voiceDirty]);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }
  if (isError || !data) {
    return <p className="p-4 text-red-600 dark:text-red-400">{t("settings.ai.loadError")}</p>;
  }

  const { settings, effective, codeDefaults, geminiKeyConfigured, audioOptions } = data;

  const save = (
    ai: AppSettingsUpdate["ai"],
    successKey = "settings.ai.saved",
    onSaved?: (saved: AppSettingsResponse) => void,
  ) =>
    update.mutate({ ai }, {
      onSuccess: (saved) => {
        toast.success(t(successKey));
        onSaved?.(saved);
      },
      onError: (error) => toast.error(`${t("settings.ai.saveError")} ${error.message}`),
    });

  const handleTestOllama = async () => {
    setTesting(true);
    try {
      const result = await settingsApi.testOllama(ollamaUrl);
      setOllamaTest(result);
      if (result.ok && result.models.length > 0 && !result.models.includes(ollamaModel)) {
        setOllamaModel(result.models[0]);
        setOllamaDirty(ollamaUrl !== effective.ollamaBaseUrl || result.models[0] !== effective.ollamaModel);
      }
    } catch (error) {
      setOllamaTest({ ok: false, baseUrl: ollamaUrl, models: [], error: (error as Error).message });
    } finally {
      setTesting(false);
    }
  };

  // Models offered for Ollama: the tested instance's, plus the current one
  const ollamaModels = [...new Set([...(ollamaTest?.models ?? []), ollamaModel].filter(Boolean))];
  const ollamaChanged = ollamaUrl !== effective.ollamaBaseUrl || ollamaModel !== effective.ollamaModel;
  const timeoutIsValid = (key: AiTimeoutKey, value: string) => isValidAiTimeoutSeconds(key, value);
  const timeoutsValid = (Object.keys(AI_TIMEOUT_LIMITS_SECONDS) as AiTimeoutKey[])
    .every(key => timeoutIsValid(key, timeouts[key]));
  const isTimeoutDraftChanged = (draft: typeof timeouts) => (
    draft.gemini !== toSeconds(settings.ai.geminiTimeoutMs) ||
    draft.geminiWeek !== toSeconds(settings.ai.geminiWeekTimeoutMs) ||
    draft.ollama !== toSeconds(settings.ai.ollamaTimeoutMs)
  );

  const syncOllama = (saved: AppSettingsResponse) => {
    setOllamaUrl(saved.effective.ollamaBaseUrl);
    setOllamaModel(saved.effective.ollamaModel);
    setOllamaDirty(false);
  };
  const syncVoice = (saved: AppSettingsResponse) => {
    setVoiceDraft(voiceDraftFrom(saved.settings.ai.audio, saved.audioOptions.defaults));
    setVoiceDirty(false);
  };
  const voiceIsDefault = Object.values(settings.ai.audio).every((value) => value === null);

  const syncTimeouts = (saved: AppSettingsResponse) => {
    setTimeouts({
      gemini: toSeconds(saved.settings.ai.geminiTimeoutMs),
      geminiWeek: toSeconds(saved.settings.ai.geminiWeekTimeoutMs),
      ollama: toSeconds(saved.settings.ai.ollamaTimeoutMs),
    });
    setTimeoutsDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Default provider */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.ai.providerTitle")}</CardTitle>
          <CardDescription>{t("settings.ai.providerDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="default-provider">{t("settings.ai.defaultProvider")}</Label>
          <Select
            value={effective.defaultProvider}
            onValueChange={(value) => save({ defaultProvider: value as AiProvider })}
            disabled={update.isPending}
          >
            <SelectTrigger id="default-provider" className="w-full sm:w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">{t("create.generate.provider.gemini")}</SelectItem>
              <SelectItem value="local">{t("create.generate.provider.local")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Gemini */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Gemini</CardTitle>
            {geminiKeyConfigured ? (
              <Badge className="gap-1 bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3" /> {t("settings.ai.keyConfigured")}</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {t("settings.ai.keyMissing")}</Badge>
            )}
          </div>
          <CardDescription>{t("settings.ai.geminiDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("settings.ai.quotaNote")}</span>
          </div>

          <ModelListEditor
            id="gemini-models"
            label={t("settings.ai.storyModels")}
            models={effective.geminiModels}
            isCustom={settings.ai.geminiModels !== null}
            saving={update.isPending}
            onSave={(models) => save({ geminiModels: models })}
          />
          <ModelListEditor
            id="gemini-audio-models"
            label={t("settings.ai.audioModels")}
            models={effective.geminiAudioModels}
            isCustom={settings.ai.geminiAudioModels !== null}
            saving={update.isPending}
            onSave={(models) => save({ geminiAudioModels: models })}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("settings.ai.codeDefaults", { count: codeDefaults.geminiModels.length })}
          </p>

          {/* Paused models */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("settings.ai.pausedTitle")}</h4>
            {(aiStatus.data?.pausedModels.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.ai.noPausedModels")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {aiStatus.data!.pausedModels.map((paused) => (
                  <li key={paused.model} className="flex flex-wrap gap-2">
                    <span className="font-mono">{paused.model}</span>
                    <Badge variant="outline">{paused.reason}</Badge>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t("settings.ai.pausedUntil", { time: new Date(paused.until).toLocaleString() })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reading voice of the audio stories */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.ai.voice.title")}</CardTitle>
          <CardDescription>{t("settings.ai.voice.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {voiceDraft && (
            <VoiceOptionsFields
              id="settings-voice"
              options={audioOptions}
              value={voiceDraft}
              onChange={(draft) => { setVoiceDraft(draft); setVoiceDirty(true); }}
              disabled={!geminiKeyConfigured || update.isPending}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!voiceDirty || !voiceDraft || update.isPending} onClick={() => voiceDraft && save({ audio: voiceDraft }, "settings.ai.saved", syncVoice)}>
              {t("common.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1"
              disabled={voiceIsDefault || update.isPending}
              onClick={() => save({ audio: { voice: null, characterVoice: null, style: null, pace: null, multiSpeaker: null } }, "settings.ai.saved", syncVoice)}
            >
              <RotateCcw className="h-3 w-3" /> {t("settings.ai.restoreDefault")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quota use (every Gemini request sent) */}
      <QuotaUsageCard />

      {/* Ollama */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.ai.ollamaTitle")}</CardTitle>
          <CardDescription>{t("settings.ai.ollamaDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ollama-url">{t("settings.ai.ollamaUrl")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="ollama-url" value={ollamaUrl} disabled={update.isPending} onChange={(e) => {
                setOllamaUrl(e.target.value);
                setOllamaDirty(e.target.value !== effective.ollamaBaseUrl || ollamaModel !== effective.ollamaModel);
                setOllamaTest(null);
              }} className="font-mono text-sm" />
              <Button type="button" variant="outline" onClick={handleTestOllama} disabled={testing || !ollamaUrl.trim()} className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                {t("settings.ai.testConnection")}
              </Button>
            </div>
            {ollamaTest && (
              <p className={`text-sm ${ollamaTest.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} role="status">
                {ollamaTest.ok
                  ? t("settings.ai.testOk", { count: ollamaTest.models.length })
                  : `${t("settings.ai.testFailed")} ${ollamaTest.error ?? ""}`}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ollama-model">{t("settings.ai.ollamaModel")}</Label>
            <Select value={ollamaModel} onValueChange={(value) => {
              setOllamaModel(value);
              setOllamaDirty(ollamaUrl !== effective.ollamaBaseUrl || value !== effective.ollamaModel);
            }} disabled={update.isPending}>
              <SelectTrigger id="ollama-model" className="w-full sm:w-[280px] font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ollamaModels.map((model) => (
                  <SelectItem key={model} value={model} className="font-mono text-sm">{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.ai.ollamaModelHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!ollamaChanged || update.isPending} onClick={() => save({ ollamaBaseUrl: ollamaUrl.trim(), ollamaModel }, "settings.ai.saved", syncOllama)}>
              {t("common.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1"
              disabled={(settings.ai.ollamaBaseUrl === null && settings.ai.ollamaModel === null) || update.isPending}
              onClick={() => { setOllamaTest(null); save({ ollamaBaseUrl: null, ollamaModel: null }, "settings.ai.saved", syncOllama); }}
            >
              <RotateCcw className="h-3 w-3" /> {t("settings.ai.restoreEnv")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Creativity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.ai.creativityTitle")}</CardTitle>
          <CardDescription>{t("settings.ai.creativityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("settings.ai.creativityLow")}</span>
            <Slider
              min={0.2}
              max={1.2}
              step={0.1}
              value={[creativity]}
              onValueChange={([value]) => {
                setCreativity(value);
                setCreativityDirty(value !== (settings.ai.creativity ?? DEFAULT_CREATIVITY));
              }}
              onValueCommit={([value]) => save({ creativity: Math.round(value * 10) / 10 }, "settings.ai.saved", (saved) => {
                setCreativity(saved.settings.ai.creativity ?? DEFAULT_CREATIVITY);
                setCreativityDirty(false);
              })}
              aria-label={t("settings.ai.creativityTitle")}
              className="flex-1"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{t("settings.ai.creativityHigh")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{settings.ai.creativity === null ? t("settings.ai.creativityDefault") : creativity.toFixed(1)}</Badge>
            <Button type="button" size="sm" variant="ghost" className="gap-1" disabled={settings.ai.creativity === null || update.isPending} onClick={() => save({ creativity: null }, "settings.ai.saved", (saved) => {
              setCreativity(saved.settings.ai.creativity ?? DEFAULT_CREATIVITY);
              setCreativityDirty(false);
            })}>
              <RotateCcw className="h-3 w-3" /> {t("settings.ai.restoreDefault")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeouts */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.ai.timeoutsTitle")}</CardTitle>
          <CardDescription>{t("settings.ai.timeoutsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            ["gemini", "settings.ai.timeoutGemini", effective.geminiTimeoutMs],
            ["geminiWeek", "settings.ai.timeoutGeminiWeek", effective.geminiWeekTimeoutMs],
            ["ollama", "settings.ai.timeoutOllama", effective.ollamaTimeoutMs],
          ] as const).map(([key, labelKey, inUse]) => (
          <div key={key} className="space-y-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor={`timeout-${key}`}>{t(labelKey)}</Label>
              <Input
                id={`timeout-${key}`}
                type="number"
                min={10}
                max={AI_TIMEOUT_LIMITS_SECONDS[key]}
                step="0.001"
                inputMode="decimal"
                value={timeouts[key]}
                placeholder={toSeconds(inUse)}
                disabled={update.isPending}
                aria-invalid={!timeoutIsValid(key, timeouts[key])}
                aria-describedby={`timeout-${key}-error`}
                onChange={(e) => {
                  const next = { ...timeouts, [key]: e.target.value };
                  setTimeouts(next);
                  setTimeoutsDirty(isTimeoutDraftChanged(next));
                }}
                className="w-full sm:w-[140px]"
              />
            </div>
            <p id={`timeout-${key}-error`} className={`text-xs ${timeoutIsValid(key, timeouts[key]) ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}`} role={timeoutIsValid(key, timeouts[key]) ? undefined : "alert"}>
              {timeoutIsValid(key, timeouts[key])
                ? t("settings.ai.timeoutRange", { min: "10", max: String(AI_TIMEOUT_LIMITS_SECONDS[key]) })
                : t("settings.ai.timeoutInvalid", { min: "10", max: String(AI_TIMEOUT_LIMITS_SECONDS[key]) })}
            </p>
          </div>
          ))}
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.ai.timeoutsHint")}</p>
          <Button
            type="button"
            size="sm"
            disabled={!timeoutsValid || update.isPending}
            onClick={() => save({
              geminiTimeoutMs: toMs(timeouts.gemini),
              geminiWeekTimeoutMs: toMs(timeouts.geminiWeek),
              ollamaTimeoutMs: toMs(timeouts.ollama),
            }, "settings.ai.saved", syncTimeouts)}
          >
            {t("common.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
