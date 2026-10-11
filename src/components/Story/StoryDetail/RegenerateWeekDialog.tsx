import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { i18n } from '@/lib/i18n';
import { getApiError } from '@/lib/apiError';
import { generationJobsApi } from '@/api/generationJobs.api';
import { useGenerationJobMutations } from '@/hooks/useGenerationJobs';
import { GenerationEstimate, GenerationJobInput } from '@/types/generation.types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import QuotaEstimate from '@/components/Generation/QuotaEstimate';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** French day names expected by the generation jobs, by day_order. */
const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

interface RegenerateWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story: { week_number: number; age_group: string; day_order: number; series_name?: string | null };
}

/**
 * Asks the AI to rewrite the week of a story, or only its day, in place: the stories keep their id and their
 * illustrations, the old text stays in the versions, the audio goes, the stories go back to "to review".
 * Runs as a generation job (progress, pause and log on the Generation page).
 */
const RegenerateWeekDialog = ({ open, onOpenChange, story }: RegenerateWeekDialogProps) => {
  const { t } = i18n;
  const navigate = useNavigate();
  const { create } = useGenerationJobMutations();
  const [scope, setScope] = useState<'week' | 'day'>('week');
  const [estimate, setEstimate] = useState<GenerationEstimate | null>(null);
  // From 7 years old, a regeneration exists to get a better model: no fall back to Flash Lite by default
  const [flashOnly, setFlashOnly] = useState(!['2-3', '4-6'].includes(story.age_group));
  const day = DAYS_FR[story.day_order - 1];

  const input: GenerationJobInput = {
    weeks: [story.week_number],
    ages: [story.age_group],
    day: 'Toute la semaine',
    seriesName: story.series_name || '',
    skipExisting: true,
    regenerate: true,
    regenerateDays: scope === 'day' && day ? [day] : [],
    flashOnly,
  };

  // Requests and quota of what is asked, refreshed when the scope changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEstimate(null);
    generationJobsApi.estimate(input)
      .then((result) => { if (!cancelled) setEstimate(result); })
      .catch(() => { if (!cancelled) setEstimate(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope, flashOnly, story.week_number, story.age_group, story.series_name]);

  const start = async () => {
    try {
      const job = await create.mutateAsync(input);
      onOpenChange(false);
      toast.success(t('story.regenerate.started'), {
        action: { label: t('story.regenerate.follow'), onClick: () => navigate(`/generation?tab=jobs&job=${job.id}`) },
      });
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  const where = [
    t('story.detail.weekShort', { week: String(story.week_number) }),
    t(`ages.${story.age_group}`),
    story.series_name || null,
  ].filter(Boolean).join(' · ');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('story.regenerate.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('story.regenerate.description', { where })}</AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup value={scope} onValueChange={(value) => setScope(value as 'week' | 'day')} className="gap-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem id="regenerate-week" value="week" />
            <Label htmlFor="regenerate-week">{t('story.regenerate.wholeWeek')}</Label>
          </div>
          {day && (
            <div className="flex items-center gap-2">
              <RadioGroupItem id="regenerate-day" value="day" />
              <Label htmlFor="regenerate-day">{t('story.regenerate.onlyDay', { day: t(`days.${['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][story.day_order - 1]}`) })}</Label>
            </div>
          )}
        </RadioGroup>

        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t('story.regenerate.keepIllustrations')}</li>
          <li>{t('story.regenerate.versions')}</li>
          <li>{t('story.regenerate.audio')}</li>
        </ul>

        <div className="flex items-start gap-2">
          <Checkbox id="regenerate-flash-only" checked={flashOnly} onCheckedChange={(checked) => setFlashOnly(checked === true)} />
          <div className="space-y-0.5">
            <Label htmlFor="regenerate-flash-only">{t('generation.quota.flashOnly')}</Label>
            <p className="text-xs text-muted-foreground">{t('generation.quota.flashOnlyHint')}</p>
          </div>
        </div>

        <div className="space-y-1 text-sm" role="status">
          {!estimate ? (
            <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('story.regenerate.estimating')}</p>
          ) : (
            <>
              <p>
                {t('story.regenerate.cost', {
                  requests: String(estimate.requests),
                  minutes: String(Math.max(1, Math.round(estimate.estimatedSeconds / 60))),
                })}
              </p>
              <QuotaEstimate estimate={estimate} flashOnly={flashOnly} />
            </>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <Button onClick={start} disabled={create.isPending || !estimate || estimate.toGenerate === 0} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('story.regenerate.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RegenerateWeekDialog;
