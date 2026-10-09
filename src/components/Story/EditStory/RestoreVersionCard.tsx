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
import { storyPreview } from "@/lib/utils";
import { StoryVersion } from "@/types/Story";

interface RestoreVersionCardProps {
    versions: StoryVersion[];
    selectedVersion: string | null;
    setSelectedVersion: (version: string) => void;
    handleRestoreVersion: () => void;
    saving: boolean;
    /** The form has unsaved changes: they will be lost by the restore */
    hasUnsavedChanges?: boolean;
}

/** Plain-text preview of stored content (editor HTML or markdown). */
const previewText = (content: string) => storyPreview(content, 300);

const RestoreVersionCard = ({
    versions,
    selectedVersion,
    setSelectedVersion,
    handleRestoreVersion,
    saving,
    hasUnsavedChanges = false
}: RestoreVersionCardProps) => {
    const { t } = i18n;
    const selected = versions.find((version) => version.id === selectedVersion);
    const currentLocale = i18n.getCurrentLocale();
    const dateFormatLocale = currentLocale === "obf" ? "fr" : currentLocale;
    const formatVersionDate = (value: string) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? value
            : new Intl.DateTimeFormat(dateFormatLocale, { dateStyle: "medium", timeStyle: "short" }).format(date);
    };

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
                disabled={saving}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
                <option value="" disabled>
                {t("story.selectVersion")}
                </option>
                {versions.map((version) => (
                <option
                    key={version.id}
                    value={version.id}
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                    {t("story.version")} {version.version} - {formatVersionDate(version.createdAt)}
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
                                        <p className="text-xs text-muted-foreground">
                                            {t("story.versionDetails", {
                                                age: t(`ages.${selected.ageGroup}`),
                                                themes: selected.themes.map((theme) => theme.name).join(", ") || t("story.noThemes"),
                                            })}
                                        </p>
                                        <p className="text-sm mt-1">{previewText(selected.content)}</p>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestoreVersion} disabled={saving}>{t("story.restore")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </CardFooter>
        </Card>
    );
};
export default RestoreVersionCard;
