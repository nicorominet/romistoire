import React, { useRef, useState } from "react";
import { i18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { Download, Upload, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSystemMutations } from "@/hooks/useSystem";
import { useAppSettings } from "@/hooks/useAppSettings";
import { systemApi } from "@/api/system.api";
import { downloadBlob, generateDateFilename } from "@/utils/fileUtils";
import { ExportType, ImportMode } from "@/types/system.types";

/**
 * DataSettings Component
 * 
 * Manages data import/export, cleanup, and factory reset operations.
 * Uses system mutations for API interactions and provides safe confirmations for destructive actions.
 */
export const DataSettings = () => {
    const { t } = i18n;
    
    // Mutations for data operations
    const { importData, resetData, cleanupImages } = useSystemMutations();
    const { data: appSettings } = useAppSettings();
    
    // Local state
    const [importMode, setImportMode] = useState<ImportMode>('skip');
    const [isExporting, setIsExporting] = useState(false);
    const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Composite loading state
    const isLoading = importData.isPending || resetData.isPending || cleanupImages.isPending || isExporting;

    /**
     * Handles data export (JSON or ZIP).
     * Downloads the file directly using browser blob handling.
     * 
     * @param {ExportType} type - 'json' to export data only, 'zip' for full backup with images.
     */
    const handleExportData = async (type: ExportType) => {
        setIsExporting(true);
        try {
            const action = type === 'zip' ? systemApi.exportFull : systemApi.exportData;
            
            // Client already returns unwrapped data (the blob)
            const blob = await action();

            // Generate filename and trigger download
            const extension = type === 'zip' ? 'zip' : 'json';
            const prefix = type === 'zip' ? 'imagitales-full-export' : 'imagitales-data-export';
            const filename = generateDateFilename(prefix, extension);

            downloadBlob(blob, filename);

            toast.success(t("settings.dataExported"));
        } catch (error) {
            console.error("Error exporting data:", error);
            toast.error(t("settings.exportError"));
        } finally {
            setIsExporting(false);
        }
    };

    /**
     * Opens the file picker. In overwrite mode, a confirmation is asked first.
     */
    const handleImportClick = () => {
        if (importMode === 'overwrite') {
            setConfirmOverwriteOpen(true);
        } else {
            fileInputRef.current?.click();
        }
    };

    /**
     * Handles data import from a file.
     *
     * @param {React.ChangeEvent<HTMLInputElement>} event - File input change event.
     */
    const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Reset so that picking the same file again triggers onChange
        event.target.value = '';
        if (!file) {
            toast.error(t("settings.importNoFile"));
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', importMode);

        try {
            const result = await importData.mutateAsync(formData);
            const summary = t("settings.importSummary", {
                inserted: result.inserted,
                skipped: result.skipped,
                failed: result.failed,
            });
            if (result.failed > 0) {
                toast.warning(summary);
            } else {
                toast.success(summary);
            }
            // UI update handled by React Query invalidation in hook
        } catch (error: any) {
             console.error("Import failed:", error);
             toast.error(error.message || t("settings.importError"));
        }
    };

    /**
     * Handles factory reset (server-side data; settings and the weekly program are kept).
     */
    const handleClearData = async () => {
        try {
            await resetData.mutateAsync();

            toast.success(t("settings.dataCleared"));
            // UI update handled by React Query invalidation in hook
        } catch (error) {
            console.error("Clear data failed:", error);
            toast.error(t("settings.clearError"));
        }
    };

    /** Handles cleanup of unreferenced images and audio files. */
    const handleCleanupImages = async () => {
        try {
            const result = await cleanupImages.mutateAsync();

            if (result && result.success) {
                toast.success(t("settings.cleanupSuccess", { 
                    count: result.deletedCount, 
                    size: (result.reclaimedSpace / 1024 / 1024).toFixed(2) 
                }));
            } else {
                toast.error(result?.message || t("settings.cleanupError"));
            }
        } catch (error) {
            console.error("Cleanup failed:", error);
            toast.error(t("settings.cleanupError"));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("settings.data")}</CardTitle>
                <CardDescription>{t("settings.dataDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("common.loading")}
                    </div>
                )}

                {/* Kept visible during operations, but disabled */}
                <fieldset disabled={isLoading} className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="font-medium">{t("settings.exportData")}</h3>
                            <p className="text-sm text-gray-500">
                                {t("settings.exportDescription")}
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    variant="outline"
                                    onClick={() => handleExportData('zip')}
                                    className="flex items-center gap-1 flex-1"
                                >
                                    <Download className="h-4 w-4" />
                                    {t("settings.exportFullZip")}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => handleExportData('json')}
                                    className="flex items-center gap-1 text-xs text-gray-500"
                                >
                                    <Download className="h-3 w-3" />
                                    {t("settings.exportJsonOnly")}
                                </Button>
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="font-medium">{t("settings.importData")}</h3>
                            <p className="text-sm text-gray-500">
                                {t("settings.importDescription")}
                            </p>

                            {/* Import Mode Selection */}
                            <div className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="skip"
                                        name="importMode"
                                        value="skip"
                                        checked={importMode === 'skip'}
                                        onChange={() => setImportMode('skip')}
                                        className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                                    />
                                    <Label htmlFor="skip" className="text-sm font-normal cursor-pointer">
                                        {t("settings.importSkip")}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="overwrite"
                                        name="importMode"
                                        value="overwrite"
                                        checked={importMode === 'overwrite'}
                                        onChange={() => setImportMode('overwrite')}
                                        className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                                    />
                                    <Label htmlFor="overwrite" className="text-sm font-normal cursor-pointer">
                                        {t("settings.importOverwrite")}
                                    </Label>
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                id="import-file"
                                className="hidden"
                                accept=".json,.zip"
                                onChange={handleImportData}
                            />
                            <Button
                                variant="outline"
                                className="flex items-center gap-1"
                                onClick={handleImportClick}
                            >
                                <Upload className="h-4 w-4" />
                                {t("settings.importButton")}
                            </Button>

                            {/* Overwrite mode: confirmation first, then the file picker */}
                            <AlertDialog open={confirmOverwriteOpen} onOpenChange={setConfirmOverwriteOpen}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t("settings.confirmOverwriteTitle")}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t("settings.confirmOverwriteDesc")}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => fileInputRef.current?.click()}
                                            className="bg-red-500 hover:bg-red-600"
                                        >
                                            {t("settings.confirmOverwrite")}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <h3 className="font-medium text-red-500">
                                {t("settings.dangerZone")}
                            </h3>
                            <div className="flex items-center gap-2 text-yellow-600 mb-4">
                                <AlertCircle className="h-5 w-5" />
                                <span>{t("settings.dangerDescription")}</span>
                            </div>

                            {/* Cleanup Images */}
                            <div className="flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
                                <div>
                                    <h4 className="font-medium mb-1">{t("settings.cleanupImagesTitle")}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {t("settings.cleanupImagesDesc")}
                                    </p>
                                    {appSettings && (
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            {t("settings.cleanupGracePeriod", {
                                                hours: String(appSettings.settings.storage.orphanPurge.maxAgeHours),
                                            })}
                                        </p>
                                    )}
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-100">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            {t("settings.cleanup")}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t("settings.confirmCleanupTitle")}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("settings.confirmCleanupDesc")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleCleanupImages} className="bg-yellow-600 hover:bg-yellow-700">
                                                {t("settings.confirmCleanup")}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>

                            <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                <div>
                                    <h4 className="font-medium mb-1 text-red-700 dark:text-red-400">{t("settings.factoryReset")}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {t("settings.factoryResetDesc")}
                                    </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            className="flex items-center gap-1"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            {t("settings.clearButton")}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                {t("settings.confirmClear")}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("settings.clearWarning")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                {t("common.cancel")}
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleClearData}
                                                className="bg-red-500 hover:bg-red-600"
                                            >
                                                {t("settings.clearConfirm")}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                </fieldset>
            </CardContent>
        </Card>
    );
};
