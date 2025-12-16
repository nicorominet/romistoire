import React, { useState, useEffect } from "react";
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
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Code2 } from "lucide-react";

interface GeneralSettingsProps {
  devMode: boolean;
  onToggleDevMode: (checked: boolean) => void;
}

export const GeneralSettings = ({ devMode, onToggleDevMode }: GeneralSettingsProps) => {
  const { t, changeLocale } = i18n;

  const [darkMode, setDarkMode] = useState<boolean>(
    document.documentElement.classList.contains("dark")
  );
  const [autoSave, setAutoSave] = useState<boolean>(true);

  // Load initial state
  useEffect(() => {
    const savedAutoSave = localStorage.getItem("autoSave");
    if (savedAutoSave !== null) {
      setAutoSave(savedAutoSave === "true");
    }
  }, []);

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle("dark", checked);
    localStorage.setItem("theme", checked ? "dark" : "light");
    toast.success(t("settings.appearanceChanged"));
  };

  const handleAutoSaveToggle = (checked: boolean) => {
    setAutoSave(checked);
    localStorage.setItem("autoSave", checked.toString());
    toast.success(t("settings.autoSaveChanged"));
  };

  const handleResetSettings = () => {
    try {
      // Reset Language
      changeLocale("fr");
      // Reset Theme
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      // Reset AutoSave
      setAutoSave(true);
      localStorage.setItem("autoSave", "true");

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
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="dark-mode">{t("settings.darkMode")}</Label>
            <p className="text-sm text-gray-500">
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
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-save">{t("settings.autoSave")}</Label>
            <p className="text-sm text-gray-500">
              {t("settings.autoSaveDescription")}
            </p>
          </div>
          <Switch
            id="auto-save"
            checked={autoSave}
            onCheckedChange={handleAutoSaveToggle}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="dev-mode" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              {t("settings.developerMode")}
            </Label>
            <p className="text-sm text-gray-500">
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
