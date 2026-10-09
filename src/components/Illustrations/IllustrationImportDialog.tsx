import { useEffect, useMemo, useRef, useState } from "react";
import { FileArchive, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { i18n } from "@/lib/i18n";
import { IllustrationTodo } from "@/api/illustrations.api";
import { ImportMatch, extractImages, matchImportFiles } from "@/utils/illustrationImport";

const SKIP = "__skip__";

interface Row extends ImportMatch {
  preview: string;
}

interface IllustrationImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Stories of the list, in list order. Those without image receive the files matched by order. */
  stories: IllustrationTodo[];
  /** Ids of the stories that received an image in this session (not proposed again by order). */
  attachedIds: Set<string>;
  onAttach: (item: IllustrationTodo, file: File) => Promise<void>;
}

/**
 * Batch import: images or ZIP (e.g. from the Gemini Canvas tool). Each file goes to the story of the code in
 * its name, otherwise to the next story without image in download order. Every match can be changed before sending.
 */
export const IllustrationImportDialog = ({ open, onOpenChange, stories, attachedIds, onAttach }: IllustrationImportDialogProps) => {
  const { t } = i18n;
  const [rows, setRows] = useState<Row[]>([]);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const storiesById = useMemo(() => new Map(stories.map(story => [story.id, story])), [stories]);

  // Free the previews when the rows change or the dialog closes
  useEffect(() => () => rows.forEach(row => URL.revokeObjectURL(row.preview)), [rows]);
  useEffect(() => {
    if (!open) setRows([]);
  }, [open]);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    try {
      const images = await extractImages(Array.from(files));
      if (images.length === 0) {
        toast.error(t("illustrations.import.noImage"));
        return;
      }
      // Stories that already have an image are reached by code only, never by order
      const waiting = stories.filter(story => story.illustrationCount === 0 && !attachedIds.has(story.id));
      const matches = matchImportFiles(images, stories, waiting);
      setRows(matches.map(match => ({ ...match, preview: URL.createObjectURL(match.file) })));
    } catch (error) {
      toast.error(t("illustrations.import.readError"), { description: (error as Error).message });
    } finally {
      setReading(false);
    }
  };

  const toSend = rows.filter(row => row.storyId);

  const send = async () => {
    setSending(true);
    setDone(0);
    let failed = 0;
    for (const row of toSend) {
      const story = storiesById.get(row.storyId!);
      try {
        if (story) await onAttach(story, row.file);
      } catch {
        failed++;
      }
      setDone(count => count + 1);
    }
    setSending(false);
    if (failed === 0) {
      toast.success(t("illustrations.import.success", { count: toSend.length }));
      onOpenChange(false);
    } else {
      toast.error(t("illustrations.import.partial", { failed, count: toSend.length }));
    }
  };

  const label = (story: IllustrationTodo) => `${story.code} · ${story.title}`;

  return (
    <Dialog open={open} onOpenChange={value => !sending && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("illustrations.import.title")}</DialogTitle>
          <DialogDescription>{t("illustrations.import.description")}</DialogDescription>
        </DialogHeader>

        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,.zip,application/zip"
          className="hidden"
          onChange={event => {
            pick(event.target.files);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={reading || sending}>
          {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
          {t("illustrations.import.pick")}
        </Button>

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={`${row.file.name}-${index}`} className="flex items-center gap-3 rounded-md border p-2">
                <img src={row.preview} alt={row.file.name} className="h-14 w-20 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-xs text-muted-foreground" title={row.file.name}>
                    {row.file.name}
                    {row.by && ` · ${t(`illustrations.import.by.${row.by}`)}`}
                  </p>
                  <Select
                    value={row.storyId ?? SKIP}
                    disabled={sending}
                    onValueChange={value => setRows(current => current.map((item, i) =>
                      i === index ? { ...item, storyId: value === SKIP ? null : value, by: null } : item
                    ))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>{t("illustrations.import.skip")}</SelectItem>
                      {stories.map(story => (
                        <SelectItem key={story.id} value={story.id}>{label(story)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}

        {sending && <Progress value={(done / Math.max(toSend.length, 1)) * 100} />}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>{t("common.cancel")}</Button>
          <Button type="button" onClick={send} disabled={sending || toSend.length === 0}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {t("illustrations.import.attach", { count: toSend.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
