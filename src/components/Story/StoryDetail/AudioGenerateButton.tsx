import { useState } from "react";
import { Headphones, Loader2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppSettings } from "@/hooks/useAppSettings";
import { VoiceDraft, VoiceOptionsFields, voiceDraftFrom } from "@/components/Settings/VoiceOptionsFields";
import { AudioSettings } from "@/types/system.types";

interface AudioGenerateButtonProps {
  /** Age group of the story: what the "auto" style and pace follow */
  ageGroup: string;
  hasAudio: boolean;
  isPending: boolean;
  onGenerate: (voice: Partial<AudioSettings>) => void;
}

/**
 * AudioGenerateButton Component
 *
 * Generate / regenerate the audio of a story: opens the reading voice, pre-filled with
 * Settings > AI > reading voice; the choices made here apply to this story only.
 */
const AudioGenerateButton = ({ ageGroup, hasAudio, isPending, onGenerate }: AudioGenerateButtonProps) => {
  const { t } = i18n;
  const { data } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);

  const handleOpenChange = (next: boolean) => {
    // Every opening starts again from the saved settings
    if (next && data) setDraft(voiceDraftFrom(data.settings.ai.audio, data.audioOptions.defaults));
    setOpen(next);
  };

  const generate = () => {
    setOpen(false);
    onGenerate(draft ?? {});
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
          {hasAudio ? t("story.audio.regenerate") : t("story.audio.generate")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] space-y-4">
        <div>
          <h3 className="font-semibold">{t("settings.ai.voice.title")}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("story.audio.voiceHint")}</p>
        </div>
        {data && draft && (
          <VoiceOptionsFields id="story-voice" options={data.audioOptions} value={draft} onChange={setDraft} ageGroup={ageGroup} />
        )}
        <Button type="button" className="w-full gap-2" onClick={generate}>
          <Headphones className="h-4 w-4" />
          {hasAudio ? t("story.audio.regenerate") : t("story.audio.generate")}
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default AudioGenerateButton;
