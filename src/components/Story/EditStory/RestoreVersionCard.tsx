import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { i18n } from "@/lib/i18n";

interface RestoreVersionCardProps {
    versions: any[];
    selectedVersion: string | null;
    setSelectedVersion: (version: string) => void;
    handleRestoreVersion: () => void;
    saving: boolean;
}

const RestoreVersionCard = ({
    versions,
    selectedVersion,
    setSelectedVersion,
    handleRestoreVersion,
    saving
}: RestoreVersionCardProps) => {
    const { t } = i18n;
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
            <Button
                onClick={handleRestoreVersion}
                disabled={!selectedVersion || saving}
                className="w-full bg-story-purple hover:bg-story-purple-600 flex items-center gap-1 text-gray-900 dark:text-gray-100"
            >
                <History className="h-4 w-4" />
                {t("story.restore")}
            </Button>
            </CardFooter>
        </Card>
    );
};
export default RestoreVersionCard;
