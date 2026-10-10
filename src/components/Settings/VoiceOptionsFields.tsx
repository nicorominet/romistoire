import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { settingsApi } from "@/api/settings.api";
import { AudioOptions, VoicePace, VoiceStyle } from "@/types/system.types";

/** Choices of a reading; "auto" style or pace = from the age group. */
export interface VoiceDraft {
  voice: string;
  characterVoice: string;
  style: VoiceStyle;
  pace: VoicePace;
  multiSpeaker: boolean;
}

// Pace names are lower case: they also complete a sentence ("débit lent")
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Saved settings (null = default) filled with the defaults. */
export const voiceDraftFrom = (
  saved: { voice: string | null; characterVoice: string | null; style: VoiceStyle | null; pace: VoicePace | null; multiSpeaker: boolean | null },
  defaults: AudioOptions["defaults"],
): VoiceDraft => ({
  voice: saved.voice ?? defaults.voice,
  characterVoice: saved.characterVoice ?? defaults.characterVoice,
  style: saved.style ?? defaults.style,
  pace: saved.pace ?? defaults.pace,
  multiSpeaker: saved.multiSpeaker ?? defaults.multiSpeaker,
});

interface VoiceOptionsFieldsProps {
  id: string;
  options: AudioOptions;
  value: VoiceDraft;
  onChange: (value: VoiceDraft) => void;
  /** Age group of the story: shows (and previews) what "auto" gives for it */
  ageGroup?: string;
  disabled?: boolean;
}

/**
 * VoiceOptionsFields Component
 *
 * Reading voice of the audio stories: voice, style, pace, second voice for the dialogue,
 * and a short sample to listen to before generating.
 */
export const VoiceOptionsFields = ({ id, options, value, onChange, ageGroup, disabled }: VoiceOptionsFieldsProps) => {
  const { t } = i18n;
  const [previewing, setPreviewing] = useState<"loading" | "playing" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const set = (patch: Partial<VoiceDraft>) => onChange({ ...value, ...patch });

  // Audio is the rarest quota (10 requests a day per TTS model): shown next to what spends it
  const queryClient = useQueryClient();
  const { data: usage } = useQuery({ queryKey: ["quota-usage", 1], queryFn: () => settingsApi.getQuotaUsage(1) });
  const audioRemaining = usage?.audioRemaining ?? null;
  // Daily quotas come back at midnight, Pacific time
  const quotaReset = usage ? new Date(new Date(usage.dayStart).getTime() + 24 * 3600 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  const stopPreview = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setPreviewing(null);
  };
  useEffect(() => stopPreview, []);

  const handlePreview = async () => {
    if (previewing) return stopPreview();
    const controller = new AbortController();
    abortRef.current = controller;
    setPreviewing("loading");
    try {
      const blob = await settingsApi.previewVoice({ ...value, ageGroup }, controller.signal);
      if (controller.signal.aborted) return;
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = stopPreview;
      await audio.play();
      setPreviewing("playing");
      queryClient.invalidateQueries({ queryKey: ["quota-usage"] });
    } catch (error) {
      if (controller.signal.aborted) return;
      stopPreview();
      toast.error(t("settings.ai.voice.previewError"));
    }
  };

  const voiceLabel = (name: string) => {
    const trait = options.voices.find((voice) => voice.name === name)?.trait;
    return trait ? `${name} · ${t(`settings.ai.voice.traits.${trait}`)}` : name;
  };
  const voiceSelect = (field: "voice" | "characterVoice", label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-${field}`}>{label}</Label>
      <Select value={value[field]} onValueChange={(voice) => set({ [field]: voice })} disabled={disabled}>
        <SelectTrigger id={`${id}-${field}`}><SelectValue>{voiceLabel(value[field])}</SelectValue></SelectTrigger>
        <SelectContent className="max-h-72">
          {options.voices.map((voice) => (
            <SelectItem key={voice.name} value={voice.name}>{voiceLabel(voice.name)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // What "auto" and the age pace give: for this story's age, or the general rule
  const preset = ageGroup ? options.agePresets[ageGroup] : undefined;
  const autoHint = preset
    ? t("settings.ai.voice.autoHintAge", {
        age: t(`ages.${ageGroup}`),
        style: t(`settings.ai.voice.styles.${preset.style}`).toLowerCase(),
        pace: t(`settings.ai.voice.paces.${preset.pace}`),
      })
    : t("settings.ai.voice.autoHint");

  return (
    // Container query: two columns only when the fields have room (settings card), stacked in the story popover
    <div className="@container space-y-4">
      {voiceSelect("voice", value.multiSpeaker ? t("settings.ai.voice.narratorVoice") : t("settings.ai.voice.voice"))}

      <div className="grid gap-4 @lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-style`}>{t("settings.ai.voice.style")}</Label>
          <Select value={value.style} onValueChange={(style) => set({ style: style as VoiceStyle })} disabled={disabled}>
            <SelectTrigger id={`${id}-style`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.styles.map((style) => (
                <SelectItem key={style} value={style}>{t(`settings.ai.voice.styles.${style}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-pace`}>{t("settings.ai.voice.pace")}</Label>
          <Select value={value.pace} onValueChange={(pace) => set({ pace: pace as VoicePace })} disabled={disabled}>
            <SelectTrigger id={`${id}-pace`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.paces.map((pace) => (
                <SelectItem key={pace} value={pace}>{capitalize(t(`settings.ai.voice.paces.${pace}`))}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {(value.style === "auto" || value.pace === "auto") && (
        <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">{autoHint}</p>
      )}

      <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3 dark:border-white/10">
        <div className="space-y-0.5">
          <Label htmlFor={`${id}-multi`}>{t("settings.ai.voice.multiSpeaker")}</Label>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.ai.voice.multiSpeakerHint")}</p>
        </div>
        <Switch id={`${id}-multi`} checked={value.multiSpeaker} onCheckedChange={(multiSpeaker) => set({ multiSpeaker })} disabled={disabled} />
      </div>
      {value.multiSpeaker && voiceSelect("characterVoice", t("settings.ai.voice.characterVoice"))}

      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handlePreview} disabled={disabled}>
        {previewing === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : previewing === "playing" ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {previewing ? t("settings.ai.voice.previewStop") : t("settings.ai.voice.preview")}
      </Button>
      {audioRemaining !== null && (
        audioRemaining > 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.ai.voice.audioRemaining", { count: String(audioRemaining) })}</p>
        ) : (
          <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
            {t("settings.ai.voice.audioExhausted", { time: quotaReset })}
          </p>
        )
      )}
    </div>
  );
};
