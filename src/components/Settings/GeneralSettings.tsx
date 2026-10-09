import { i18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { RotateCcw, Code2 } from "lucide-react";
import { toast } from "sonner";
import useDarkMode from "@/hooks/useDarkMode";
import { setTheme, resetTheme } from "@/lib/theme";

interface GeneralSettingsProps {
  devMode: boolean;
  onToggleDevMode: (checked: boolean) => void;
}

/**
 * GeneralSettings Component
 * 
 * Manages global application settings: Theme (Dark/Light) and Developer Mode.
 * Settings are persisted in LocalStorage.
 */
export const GeneralSettings = ({ devMode, onToggleDevMode }: GeneralSettingsProps) => {
  const { t, changeLocale } = i18n;

  // Follows the "dark" class on <html>
  const darkMode = useDarkMode();

  /**
   * Toggles Dark Mode and updates DOM + LocalStorage.
   */
  const handleDarkModeToggle = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
    toast.success(t("settings.appearanceChanged"));
  };

  /**
   * Resets all general settings to default values.
   */
  const handleResetSettings = () => {
    try {
      // 1. Theme: back to the OS preference
      resetTheme();

      // 2. Developer mode off
      onToggleDevMode(false);

      // 3. Language: French (remounts the page, so it goes last)
      changeLocale("fr");

      toast.success(t("settings.settingsReset"));
    } catch (error) {
      console.error("Error resetting settings:", error);
      toast.error(t("settings.resetError"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.general")}</CardTitle>
        <CardDescription>{t("settings.generalDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="dark-mode">{t("settings.darkMode")}</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("settings.darkModeDescription")}
            </p>
          </div>
          <Switch
            id="dark-mode"
            checked={darkMode}
            onCheckedChange={handleDarkModeToggle}
          />
        </div>
        
        <Separator />
        
        {/* Developer Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="dev-mode" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              {t("settings.developerMode")}
            </Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("settings.developerModeDescription")}
            </p>
          </div>
          <Switch
            id="dev-mode"
            checked={devMode}
            onCheckedChange={onToggleDevMode}
          />
        </div>
      </CardContent>
      
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-1">
              <RotateCcw className="h-4 w-4" />
              {t("settings.resetSettings")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.confirmReset")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.resetWarning")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetSettings}>
                {t("settings.reset")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};
