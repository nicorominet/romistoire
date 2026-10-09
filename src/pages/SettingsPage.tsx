import React from "react";
import { i18n } from "@/lib/i18n";
import PageLayout from "@/components/Layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Languages, Database, Activity, Sparkles, HardDrive } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { GeneralSettings } from "@/components/Settings/GeneralSettings";
import { LanguageSettings } from "@/components/Settings/LanguageSettings";
import { DataSettings } from "@/components/Settings/DataSettings";
import { NetworkSettings } from "@/components/Settings/NetworkSettings";
import { AiSettings } from "@/components/Settings/AiSettings";
import { StorageSettings } from "@/components/Settings/StorageSettings";
import { STORAGE_KEYS } from "@/constants";

/**
 * SettingsPage Component
 * 
 * Main container for application settings.
 * Manages Developer Mode state (persisted) and renders setting tabs.
 * The active tab is kept in the URL (?tab=...): it survives a reload and the remount on language change.
 * 
 * @returns {JSX.Element} The rendered page.
 */
const SettingsPage = (): JSX.Element => {
  const { t } = i18n;

  // Developer Mode State (read synchronously: the Network tab may be the one in the URL)
  const [devMode, setDevMode] = React.useState<boolean>(
    () => localStorage.getItem(STORAGE_KEYS.DEV_MODE) === "true"
  );

  // Active tab, from the URL; unknown or hidden tabs fall back to "general"
  const [searchParams, setSearchParams] = useSearchParams();
  const { GENERAL, LANGUAGE, AI, DATA, STORAGE, NETWORK } = STORAGE_KEYS.SETTINGS_TABS;
  const userTabs: string[] = [GENERAL, LANGUAGE, AI, DATA, STORAGE];
  const availableTabs = devMode ? [...userTabs, NETWORK] : userTabs;
  const requestedTab = searchParams.get("tab") ?? GENERAL;
  const activeTab = availableTabs.includes(requestedTab) ? requestedTab : GENERAL;

  const handleTabChange = (tab: string) => {
    setSearchParams(tab === GENERAL ? {} : { tab }, { replace: true });
  };

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
              <p className="text-gray-600 dark:text-gray-400">{t("settings.description")}</p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              v{__APP_VERSION__}
            </Badge>
          </div>

          {/* Settings Tabs Container */}
          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 shadow-lg p-6">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="mb-6 h-auto flex-wrap justify-start bg-white/50 dark:bg-slate-800/50">
                
                <TabsTrigger value={GENERAL} className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <Settings className="h-4 w-4" />
                  {t("settings.general")}
                </TabsTrigger>
                
                <TabsTrigger value={LANGUAGE} className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <Languages className="h-4 w-4" />
                  {t("settings.language")}
                </TabsTrigger>
                
                <TabsTrigger value={AI} className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <Sparkles className="h-4 w-4" />
                  {t("settings.ai.tab")}
                </TabsTrigger>

                <TabsTrigger value={DATA} className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <Database className="h-4 w-4" />
                  {t("settings.data")}
                </TabsTrigger>

                <TabsTrigger value={STORAGE} className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  <HardDrive className="h-4 w-4" />
                  {t("settings.storage.tab")}
                </TabsTrigger>
                
                {/* Network Tab - Visible only in Dev Mode */}
                {devMode && (
                  <TabsTrigger value={NETWORK} className="flex items-center gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                    <Activity className="h-4 w-4" />
                    {t("settings.networkTitle")}
                  </TabsTrigger>
                )}

              </TabsList>

              <TabsContent value={GENERAL}>
                <GeneralSettings devMode={devMode} onToggleDevMode={handleDevModeToggle} />
              </TabsContent>
              
              <TabsContent value={LANGUAGE}>
                <LanguageSettings devMode={devMode} />
              </TabsContent>

              <TabsContent value={AI}>
                <AiSettings />
              </TabsContent>

              <TabsContent value={DATA}>
                <DataSettings />
              </TabsContent>

              <TabsContent value={STORAGE}>
                <StorageSettings />
              </TabsContent>

              {devMode && (
                <TabsContent value={NETWORK}>
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