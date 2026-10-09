import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ClipboardPaste, Copy, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { i18n } from "@/lib/i18n";
import { getApiError } from "@/lib/apiError";
import { ACCEPTED_IMAGE_TYPES, APP_ROUTES } from "@/constants";
import { IllustrationTodo } from "@/api/illustrations.api";
import { imageTypeOf } from "@/utils/illustrationImport";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const PROMPT_MAX = 2000;

interface IllustrationTodoRowProps {
  item: IllustrationTodo;
  /** Path ("uploads/…") or object URL of the image attached in this session. */
  attachedImage?: string;
  /** True while the AI writes this prompt (single or batch). */
  generating: boolean;
  onGeneratePrompt: (item: IllustrationTodo) => void;
  onSavePrompt: (item: IllustrationTodo, prompt: string) => Promise<void>;
  onAttach: (item: IllustrationTodo, file: File) => Promise<void>;
}

/** Image of a paste or drop event, if any. */
const imageOf = (files: FileList | undefined | null): File | null =>
  Array.from(files ?? []).find(file => imageTypeOf(file.name, file.type)) ?? null;

/**
 * One story of the workshop: its prompt (copy, edit, write with the AI) and a zone receiving the image
 * (Ctrl+V after a click, drag and drop, or file picker).
 */
export const IllustrationTodoRow = ({ item, attachedImage, generating, onGeneratePrompt, onSavePrompt, onAttach }: IllustrationTodoRowProps) => {
  const { t } = i18n;
  const saved = item.illustration_prompt ?? "";
  const [prompt, setPrompt] = useState(saved);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Follow server data (AI prompt, refetch) unless the user is typing in this field
  useEffect(() => {
    if (document.activeElement !== textarea.current) setPrompt(saved);
  }, [saved]);

  const dayKey = DAY_KEYS[item.day_order - 1];
  const image = attachedImage ?? (item.cover ? `/${item.cover}` : undefined);
  const hasImage = Boolean(attachedImage) || item.illustrationCount > 0;

  const attach = async (file: File | null) => {
    if (!file) {
      toast.error(t("illustrations.notAnImage"));
      return;
    }
    setUploading(true);
    try {
      await onAttach(item, file);
    } finally {
      setUploading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.imagePrompt);
      toast.success(t("story.promptCopied"));
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  const save = () => {
    const next = prompt.trim();
    if (next === saved.trim()) return;
    if (!next) {
      setPrompt(saved);
      return;
    }
    onSavePrompt(item, next).catch(() => setPrompt(saved));
  };

  return (
    <li className={cn("rounded-lg border bg-card p-4 shadow-sm", hasImage && "border-green-400/60")}>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{item.code}</Badge>
            <Link to={APP_ROUTES.STORY_DETAIL(item.id)} className="font-semibold hover:underline">{item.title}</Link>
            {hasImage && <Check className="h-4 w-4 text-green-600" aria-label={t("illustrations.hasImage")} />}
          </div>
          <p className="text-xs text-muted-foreground">
            {[
              item.week_number ? t("illustrations.week", { week: item.week_number }) : null,
              dayKey ? t(`days.${dayKey}`) : null,
              t(`ages.${item.age_group}`),
            ].filter(Boolean).join(" · ")}
          </p>
          <Textarea
            ref={textarea}
            value={prompt}
            maxLength={PROMPT_MAX}
            rows={4}
            onChange={event => setPrompt(event.target.value)}
            onBlur={save}
            placeholder={t("illustrations.promptPlaceholder")}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!item.imagePrompt}>
              <Copy className="mr-1 h-4 w-4" />
              {t("illustrations.copyPrompt")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onGeneratePrompt(item)} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              {saved ? t("illustrations.rewritePrompt") : t("illustrations.createPrompt")}
            </Button>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={t("illustrations.dropZone")}
          onClick={event => event.currentTarget.focus()}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInput.current?.click();
            }
          }}
          onPaste={event => {
            event.preventDefault();
            attach(imageOf(event.clipboardData?.files));
          }}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            attach(imageOf(event.dataTransfer?.files));
          }}
          className={cn(
            "group relative flex h-44 w-full shrink-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-md border-2 border-dashed p-2 text-center text-xs text-muted-foreground outline-none transition md:w-60",
            "focus:border-story-purple-500 focus:bg-story-purple-50 dark:focus:bg-story-purple-950/40",
            dragging && "border-story-purple-500 bg-story-purple-50 dark:bg-story-purple-950/40"
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : image ? (
            <>
              <img src={image} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute bottom-1 rounded bg-black/60 px-2 py-0.5 text-white opacity-0 transition group-focus:opacity-100 group-hover:opacity-100">
                {t("illustrations.pasteAnother")}
              </span>
            </>
          ) : (
            <>
              <ClipboardPaste className="h-6 w-6" />
              <span className="hidden group-focus:inline">{t("illustrations.pasteNow")}</span>
              <span className="group-focus:hidden">{t("illustrations.dropZone")}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={event => {
                  event.stopPropagation();
                  fileInput.current?.click();
                }}
              >
                <ImagePlus className="mr-1 h-4 w-4" />
                {t("illustrations.chooseFile")}
              </Button>
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={event => {
              attach(imageOf(event.target.files));
              event.target.value = "";
            }}
          />
        </div>
      </div>
    </li>
  );
};
