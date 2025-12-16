import React from "react";
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

export const LanguageSettings = () => {
  const { t, getCurrentLocale, changeLocale } = i18n;
  const [language, setLanguage] = React.useState<string>(getCurrentLocale() || "fr");

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
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
              <SelectItem value="en">{t("languages.en")}</SelectItem>
              <SelectItem value="fr">{t("languages.fr")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-2 text-blue-600">
          <Info className="h-5 w-5" />
          <span>{t("settings.languageNote")}</span>
        </div>
      </CardFooter>
    </Card>
  );
};
