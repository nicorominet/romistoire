import React from "react";
import { i18n } from "@/lib/i18n";
import PageLayout from "@/components/Layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Languages, Database } from "lucide-react";
import { GeneralSettings } from "@/components/Settings/GeneralSettings";
import { LanguageSettings } from "@/components/Settings/LanguageSettings";
import { DataSettings } from "@/components/Settings/DataSettings";
import { NetworkSettings } from "@/components/Settings/NetworkSettings";
import { STORAGE_KEYS } from "@/constants";

/**
 * SettingsPage Component
 * 
 * Main container for application settings.
 * Manages Developer Mode state (persisted) and renders setting tabs.
 * 
 * @returns {JSX.Element} The rendered page.
 */
const SettingsPage = (): JSX.Element => {
  const { t } = i18n;

  // Developer Mode State
  const [devMode, setDevMode] = React.useState<boolean>(false);

  // Load Developer Mode from LocalStorage
  React.useEffect(() => {
    const savedDevMode = localStorage.getItem(STORAGE_KEYS.DEV_MODE);
    if (savedDevMode === "true") {
      setDevMode(true);
    }
  }, []);

  /**
   * Toggles Developer Mode and updates storage.
   * @param {boolean} checked - The new state.
   */
  const handleDevModeToggle = (checked: boolean) => {
    setDevMode(checked);
    localStorage.setItem(STORAGE_KEYS.DEV_MODE, checked.toString());
  };

  return (
    <PageLayout>
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-story-purple-800">
                {t("settings.title")}
              </h1>
              <p className="text-gray-600">{t("settings.description")}</p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              v{__APP_VERSION__}
            </Badge>
          </div>

          {/* Settings Tabs Container */}
          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 shadow-lg p-6">
            <Tabs defaultValue="general">
              <TabsList className="mb-6 bg-white/50 dark:bg-slate-800/50">
                
                <TabsTrigger value="general" className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <Settings className="h-4 w-4" />
                  {t("settings.general")}
                </TabsTrigger>
                
                <TabsTrigger value="language" className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <Languages className="h-4 w-4" />
                  {t("settings.language")}
                </TabsTrigger>
                
                <TabsTrigger value="data" className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <Database className="h-4 w-4" />
                  {t("settings.data")}
                </TabsTrigger>
                
                {/* Network Tab - Visible only in Dev Mode */}
                {devMode && (
                  <TabsTrigger value="network" className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                    <Database className="h-4 w-4" />
                    {t("settings.networkTitle")}
                  </TabsTrigger>
                )}

              </TabsList>

              <TabsContent value="general">
                <GeneralSettings devMode={devMode} onToggleDevMode={handleDevModeToggle} />
              </TabsContent>
              
              <TabsContent value="language">
                <LanguageSettings />
              </TabsContent>

              <TabsContent value="data">
                <DataSettings />
              </TabsContent>

              {devMode && (
                <TabsContent value="network">
                  <NetworkSettings />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
    </PageLayout>
  );
};

export default SettingsPage;