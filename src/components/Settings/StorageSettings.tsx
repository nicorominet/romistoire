import { useState } from "react";
import { i18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Archive, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppSettings, useBackups } from "@/hooks/useAppSettings";
import { settingsApi } from "@/api/settings.api";
import { downloadBlob } from "@/utils/fileUtils";
import { AppSettingsUpdate, BackupFrequency, DirUsage } from "@/types/system.types";

/** "12.3 MB" style size. */
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-lg border bg-white/50 p-3 dark:bg-slate-800/50">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

/** Integer input saved when it loses focus (or on Enter), within [min, max]. */
const NumberSetting = ({ id, label, value, min, max, onSave }: {
  id: string; label: string; value: number; min: number; max: number; onSave: (value: number) => void;
}) => {
  const { t } = i18n;
  const [error, setError] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor={id}>{label}</Label>
        <Input
          key={value}
          id={id}
          type="number"
          min={min}
          max={max}
          defaultValue={value}
          aria-invalid={error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={() => setError(false)}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (!Number.isInteger(next) || next < min || next > max) {
              e.target.value = String(value);
              setError(true);
            } else {
              setError(false);
              if (next !== value) onSave(next);
            }
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="w-full sm:w-[120px]"
        />
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400" role="alert">{t("settings.storage.numberRange", { min: String(min), max: String(max) })}</p>}
    </div>
  );
};

/**
 * StorageSettings Component
 *
 * Settings > Storage & backups: disk usage dashboard, automatic and manual backups,
 * orphan images purge and log retention (run by the server's hourly maintenance).
 */
export const StorageSettings = () => {
  const { t } = i18n;
  const { data, isLoading: settingsLoading, isError: settingsError, refetch: refetchSettings, update } = useAppSettings();
  const { backups, stats, runBackup, deleteBackup, clearDebugLog } = useBackups();

  const save = (storage: AppSettingsUpdate["storage"]) =>
    update.mutate({ storage }, {
      onSuccess: () => toast.success(t("settings.storage.saved")),
      onError: (error) => toast.error(`${t("settings.ai.saveError")} ${error.message}`),
    });

  const handleBackupNow = () =>
    runBackup.mutate(undefined, {
      onSuccess: (result) => toast.success(t("settings.storage.backupDone", { name: result.filename })),
      onError: (error) => toast.error(`${t("settings.storage.backupError")} ${error.message}`),
    });

  const handleDownload = async (filename: string) => {
    try {
      downloadBlob(await settingsApi.downloadBackup(filename), filename);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = (filename: string) =>
    deleteBackup.mutate(filename, {
      onSuccess: () => toast.success(t("settings.storage.backupDeleted")),
      onError: (error) => toast.error((error as Error).message),
    });

  const handleClearDebugLog = () =>
    clearDebugLog.mutate(undefined, {
      onSuccess: () => toast.success(t("settings.storage.debugLogCleared")),
      onError: (error) => toast.error((error as Error).message),
    });

  const storage = data?.settings.storage;
  const s = stats.data;
  const usage = (dir?: DirUsage) => (dir ? `${formatBytes(dir.bytes)} · ${t("settings.storage.files", { count: dir.files })}` : "…");

  return (
    <div className="space-y-6">
      {/* Dashboard */}
      {settingsLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />{t("common.loading")}</div>}
      {settingsError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 p-3 text-sm text-red-700 dark:border-red-800 dark:text-red-300" role="alert">
          <span>{t("settings.storage.settingsError")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => refetchSettings()} disabled={settingsLoading}>{t("common.retry")}</Button>
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{t("settings.storage.dashboardTitle")}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => stats.refetch()} disabled={stats.isFetching} aria-label={t("settings.network.actions.refresh")}>
              <RefreshCw className={`h-4 w-4 ${stats.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <CardDescription>{t("settings.storage.dashboardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.isError && <p className="text-sm text-red-600 dark:text-red-400">{t("settings.storage.statsError")}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t("settings.storage.stories")} value={s?.counts.stories ?? "…"} />
            <Stat label={t("settings.storage.versions")} value={s?.counts.versions ?? "…"} />
            <Stat label={t("settings.storage.illustrations")} value={s?.counts.illustrations ?? "…"} />
            <Stat label={t("settings.storage.series")} value={s?.counts.series ?? "…"} />
            <Stat label={t("settings.storage.themes")} value={s?.counts.themes ?? "…"} />
            <Stat label={t("settings.storage.weeklyThemes")} value={s?.counts.weeklyThemes ?? "…"} />
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-[200px_1fr]">
            <dt className="text-gray-500 dark:text-gray-400">{t("settings.storage.uploads")}</dt>
            <dd>{usage(s?.disk.uploads)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">{t("settings.storage.logs")}</dt>
            <dd>{usage(s?.disk.logs)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">{t("settings.storage.debugLog")}</dt>
            <dd>{usage(s?.disk.debugLog)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">{t("settings.storage.backups")}</dt>
            <dd>
              {s ? `${formatBytes(s.backups.bytes)} · ${t("settings.storage.backupCount", { count: s.backups.count })}` : "…"}
              {s?.backups.last && ` · ${t("settings.storage.lastBackup", { date: new Date(s.backups.last).toLocaleString() })}`}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {/* Backups */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.storage.backupTitle")}</CardTitle>
          <CardDescription>{t("settings.storage.backupDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storage && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-backup">{t("settings.storage.autoBackup")}</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.storage.autoBackupHint")}</p>
                </div>
                <Switch
                  id="auto-backup"
                  checked={storage.autoBackup.enabled}
                  disabled={update.isPending}
                  onCheckedChange={(enabled) => save({ autoBackup: { enabled } })}
                />
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="backup-frequency">{t("settings.storage.frequency")}</Label>
                <Select
                  value={storage.autoBackup.frequency}
                  onValueChange={(frequency) => save({ autoBackup: { frequency: frequency as BackupFrequency } })}
                  disabled={update.isPending}
                >
                  <SelectTrigger id="backup-frequency" className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("settings.storage.daily")}</SelectItem>
                    <SelectItem value="weekly">{t("settings.storage.weekly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumberSetting
                id="backup-keep"
                label={t("settings.storage.keep")}
                value={storage.autoBackup.keep}
                min={1}
                max={50}
                onSave={(keep) => save({ autoBackup: { keep } })}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.storage.keepHint")}</p>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium">{t("settings.storage.backupList")}</h4>
            <Button onClick={handleBackupNow} disabled={runBackup.isPending} className="gap-2">
              {runBackup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              {t("settings.storage.backupNow")}
            </Button>
          </div>
          {backups.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />{t("common.loading")}</div>}
          {backups.isError && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 p-3 text-sm text-red-700 dark:border-red-800 dark:text-red-300" role="alert">
              <span>{t("settings.storage.backupsError")}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => backups.refetch()} disabled={backups.isFetching}>{t("common.retry")}</Button>
            </div>
          )}
          {backups.data && backups.data.length === 0 && !backups.isError ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.storage.noBackups")}</p>
          ) : backups.data && backups.data.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {backups.data!.map((backup) => (
                <li key={backup.filename} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1 min-w-[180px]">
                    {new Date(backup.createdAt).toLocaleString()}
                    <span className="ml-2 text-gray-500 dark:text-gray-400">{formatBytes(backup.size)}</span>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(backup.filename)} aria-label={t("settings.storage.download")}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={deleteBackup.isPending} aria-label={t("settings.storage.deleteBackup")}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("settings.storage.deleteBackupTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>{backup.filename}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(backup.filename)} className="bg-red-500 hover:bg-red-600">
                          {t("settings.storage.deleteBackup")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.storage.restoreHint")}</p>
        </CardContent>
      </Card>

      {/* Automatic cleanup */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.storage.cleanupTitle")}</CardTitle>
          <CardDescription>{t("settings.storage.cleanupDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storage && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="orphan-purge">{t("settings.storage.orphanPurge")}</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.storage.orphanPurgeHint")}</p>
                </div>
                <Switch
                  id="orphan-purge"
                  checked={storage.orphanPurge.enabled}
                  disabled={update.isPending}
                  onCheckedChange={(enabled) => save({ orphanPurge: { enabled } })}
                />
              </div>
              <NumberSetting
                id="orphan-age"
                label={t("settings.storage.orphanAge")}
                value={storage.orphanPurge.maxAgeHours}
                min={1}
                max={720}
                onSave={(maxAgeHours) => save({ orphanPurge: { maxAgeHours } })}
              />
              <NumberSetting
                id="log-retention"
                label={t("settings.storage.logRetention")}
                value={storage.logRetentionDays}
                min={1}
                max={365}
                onSave={(logRetentionDays) => save({ logRetentionDays })}
              />
            </>
          )}
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium">{t("settings.storage.debugLog")}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">{usage(s?.disk.debugLog)}</p>
            </div>
            <Button variant="outline" onClick={handleClearDebugLog} disabled={clearDebugLog.isPending} className="gap-2">
              <Trash2 className="h-4 w-4" /> {t("settings.storage.clearDebugLog")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
