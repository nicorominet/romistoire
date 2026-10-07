import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { History } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { truncateText } from "@/lib/utils";

interface RestoreVersionCardProps {
    versions: any[];
    selectedVersion: string | null;
    setSelectedVersion: (version: string) => void;
    handleRestoreVersion: () => void;
    saving: boolean;
    /** The form has unsaved changes: they will be lost by the restore */
    hasUnsavedChanges?: boolean;
}

/** Plain-text preview of stored content (editor HTML or markdown). */
const previewText = (content: string) => truncateText(
    (content || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim(),
    300
);

const RestoreVersionCard = ({
    versions,
    selectedVersion,
    setSelectedVersion,
    handleRestoreVersion,
    saving,
    hasUnsavedChanges = false
}: RestoreVersionCardProps) => {
    const { t } = i18n;
    const selected = versions.find((version: any) => version.id === selectedVersion);

    return (
        <Card className="mt-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">
                {t("story.restoreVersion")}
            </CardTitle>
            </CardHeader>
            <CardContent>
            <select
                value={selectedVersion || ""}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
                <option value="" disabled>
                {t("story.selectVersion")}
                </option>
                {versions.map((version: any) => (
                <option
                    key={version.id}
                    value={version.id}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                    {t("story.version")} {version.version} -{" "}
                    {new Date(version.createdAt).toLocaleString()}
                </option>
                ))}
            </select>
            </CardContent>
            <CardFooter>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button type="button"
                        disabled={!selectedVersion || saving}
                        className="w-full bg-story-purple hover:bg-story-purple-600 flex items-center gap-1 text-gray-900 dark:text-gray-100"
                    >
                        <History className="h-4 w-4" />
                        {t("story.restore")}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("story.restoreConfirmTitle", { version: String(selected?.version ?? "") })}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>{t("story.restoreConfirmDesc")}</p>
                                {hasUnsavedChanges && (
                                    <p className="font-medium text-amber-600 dark:text-amber-400">{t("story.restoreUnsavedWarning")}</p>
                                )}
                                {selected && (
                                    <div className="rounded-md border p-3 text-left text-gray-700 dark:text-gray-300">
                                        <p className="font-semibold">{selected.title}</p>
                                        <p className="text-sm mt-1">{previewText(selected.content)}</p>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreVersion}>{t("story.restore")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </CardFooter>
        </Card>
    );
};
export default RestoreVersionCard;
