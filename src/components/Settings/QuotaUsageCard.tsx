import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { settingsApi } from "@/api/settings.api";
import { ModelQuotaUsage } from "@/types/system.types";

const PERIOD_DAYS = 7;

/** "4 / 15", red once the limit is reached; the value alone when the limit is unknown. */
const AgainstLimit = ({ value, limit }: { value: number; limit: number | null }) => (
  <span className={limit !== null && value >= limit ? "font-semibold text-red-600 dark:text-red-400" : ""}>
    {value}
    {limit !== null && <span className="text-gray-400"> / {limit}</span>}
  </span>
);

const otherErrors = (m: ModelQuotaUsage) => m.period.overloaded + m.period.timeouts + m.period.errors;

/**
 * QuotaUsageCard Component
 *
 * Use of the Gemini quotas, from every request sent: requests of the quota day (Google resets it at
 * midnight, Pacific time), busiest minute, 429 answers. Limits are the indicative free tier ones.
 */
export const QuotaUsageCard = () => {
  const { t } = i18n;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["quota-usage", PERIOD_DAYS],
    queryFn: () => settingsApi.getQuotaUsage(PERIOD_DAYS),
    refetchInterval: 30000,
  });

  const anyExceeded = data?.models.some((m) => m.exceeded);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("settings.quota.title")}</CardTitle>
          {data && data.models.length > 0 && (
            anyExceeded ? (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {t("settings.quota.exceeded")}</Badge>
            ) : (
              <Badge className="gap-1 bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3" /> {t("settings.quota.withinLimits")}</Badge>
            )
          )}
        </div>
        <CardDescription>
          {t("settings.quota.description", { days: String(PERIOD_DAYS) })}
          {data && <> {t("settings.quota.dayStart", { time: new Date(data.dayStart).toLocaleString() })}</>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}
        {isError && <p className="text-sm text-red-600 dark:text-red-400">{t("settings.quota.error")}</p>}
        {data && data.models.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.quota.empty")}</p>}
        {data && data.models.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("settings.quota.model")}</TableHead>
                  <TableHead className="text-right">{t("settings.quota.today")}</TableHead>
                  <TableHead className="text-right">{t("settings.quota.peakToday")}</TableHead>
                  <TableHead className="text-right">{t("settings.quota.peakPeriod", { days: String(PERIOD_DAYS) })}</TableHead>
                  <TableHead className="text-right">{t("settings.quota.limited", { days: String(PERIOD_DAYS) })}</TableHead>
                  <TableHead className="text-right">{t("settings.quota.otherErrors")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.models.map((m) => (
                  <TableRow key={m.model}>
                    <TableCell className="font-mono text-xs">
                      {m.model}
                      {m.exceeded && <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px]">429</Badge>}
                    </TableCell>
                    <TableCell className="text-right"><AgainstLimit value={m.today.requests} limit={m.limits.rpd} /></TableCell>
                    <TableCell className="text-right"><AgainstLimit value={m.today.peakPerMinute} limit={m.limits.rpm} /></TableCell>
                    <TableCell className="text-right"><AgainstLimit value={m.period.peakPerMinute} limit={m.limits.rpm} /></TableCell>
                    <TableCell className="text-right" title={m.period.lastLimitedAt ? t("settings.quota.lastLimited", { time: new Date(m.period.lastLimitedAt).toLocaleString() }) : undefined}>
                      <span className={m.period.rateLimited + m.period.dailyQuota > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-500"}>
                        {t("settings.quota.limitedValue", { minute: String(m.period.rateLimited), day: String(m.period.dailyQuota) })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-gray-500">{otherErrors(m)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("settings.quota.note")}</p>
      </CardContent>
    </Card>
  );
};
