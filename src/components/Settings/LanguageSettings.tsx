import { i18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/constants";

/**
 * LanguageSettings Component
 * 
 * Allows users to switch the application language.
 * Changes are applied immediately (the page is remounted in the new language) and persisted.
 *
 * @param {boolean} devMode - Shows the obfuscated debug locale.
 */
export const LanguageSettings = ({ devMode }: { devMode: boolean }) => {
  const { t, getCurrentLocale, changeLocale } = i18n;
  const language = getCurrentLocale();

  /**
   * Handles language change events: applies the locale and notifies the user.
   */
  const handleLanguageChange = (value: string) => {
    changeLocale(value);
    toast.success(t("settings.languageChanged"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.language")}</CardTitle>
        <CardDescription>{t("settings.languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <Label htmlFor="language-select">{t("settings.selectLanguage")}</Label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger id="language-select" className="w-full">
              <SelectValue placeholder={t("settings.selectLanguage")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STORAGE_KEYS.LANGUAGES.EN}>{t("languages.en")}</SelectItem>
              <SelectItem value={STORAGE_KEYS.LANGUAGES.FR}>{t("languages.fr")}</SelectItem>
              {(devMode || language === STORAGE_KEYS.LANGUAGES.OBF) && (
                <SelectItem value={STORAGE_KEYS.LANGUAGES.OBF}>Obfuscated (Debug)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Info className="h-5 w-5" />
          <span>{t("settings.languageNote")}</span>
        </div>
      </CardFooter>
    </Card>
  );
};
