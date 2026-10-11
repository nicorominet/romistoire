import { AlertTriangle } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import { GenerationEstimate } from '@/types/generation.types';

interface QuotaEstimateProps {
  estimate: GenerationEstimate;
  flashOnly: boolean;
}

/**
 * Gemini quota left today, per model family: the Flash models (from 7 years old) have about 20 requests a day each,
 * Flash Lite much more, so a total over every model hid that Flash was spent. Says what happens when it runs out.
 */
const QuotaEstimate = ({ estimate, flashOnly }: QuotaEstimateProps) => {
  const { t } = i18n;
  const { quota } = estimate;
  const left = (remaining: number | null) => (remaining === null ? '?' : String(remaining));

  if (!quota) {
    return estimate.quotaWarning ? (
      <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {t('generation.quota.chosenModel', { remaining: left(estimate.remainingRequests) })}
      </p>
    ) : null;
  }

  return (
    <div className="space-y-1">
      <ul className="space-y-0.5 text-gray-600 dark:text-gray-300">
        {quota.flash.requests > 0 && (
          <li>{t('generation.quota.flash', { requests: String(quota.flash.requests), remaining: left(quota.flash.remaining) })}</li>
        )}
        {quota.lite.requests > 0 && (
          <li>{t('generation.quota.lite', { requests: String(quota.lite.requests), remaining: left(quota.lite.remaining) })}</li>
        )}
      </ul>
      {quota.flashShortfall && (
        <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(flashOnly ? 'generation.quota.flashShortfallStrict' : 'generation.quota.flashShortfall', { remaining: left(quota.flash.remaining) })}
        </p>
      )}
      {estimate.quotaWarning && !quota.flashShortfall && (
        <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('generation.form.quotaWarning', { remaining: left(quota.lite.remaining) })}
        </p>
      )}
    </div>
  );
};

export default QuotaEstimate;
