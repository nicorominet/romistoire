import React, { useEffect, useState } from 'react';
import { i18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, Plus } from "lucide-react";
import "@/App.css";
import { useThemes, useThemeMutations } from '@/hooks/useThemes';
import { useToast } from '@/hooks/use-toast';

interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

const ThemeManager: React.FC = () => {
  // Hook usage
  const { data: themes, isLoading, error } = useThemes();
  const { createTheme, updateTheme, deleteTheme } = useThemeMutations();
  const { toast } = useToast();

  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(document.documentElement.classList.contains('dark'));
  
  useEffect(() => {
    const handleDarkModeChange = () => {
      setDarkMode(document.documentElement.classList.contains('dark'));
    };

    window.addEventListener('darkModeChanged', handleDarkModeChange);

    return () => {
      window.removeEventListener('darkModeChanged', handleDarkModeChange);
    };
  }, []);

  const handleAddTheme = async () => {
    const newTheme = {
      name: "New Theme",
      description: "Description of the new theme.",
      color: "#ffffff",
      // created_at and id managed by backend
    };
    try {
       await createTheme.mutateAsync(newTheme);
       toast({ title: i18n.t("themes.addTheme"), description: "Theme added successfully" });
    } catch(e) {
       toast({ title: "Error", description: "Failed to add theme", variant: "destructive" });
    }
  };

  const handleEditTheme = async (theme: Theme) => {
    try {
       await updateTheme.mutateAsync({ id: theme.id, data: theme });
       setEditingTheme(null);
       toast({ title: i18n.t("themes.editTheme"), description: "Theme updated successfully" });
    } catch(e) {
       toast({ title: "Error", description: "Failed to update theme", variant: "destructive" });
    }
  };

  const handleRemoveTheme = async (id: string) => {
    try {
       await deleteTheme.mutateAsync(id);
       toast({ title: "Theme Removed", description: "Theme deleted successfully" });
    } catch(e) {
       toast({ title: "Error", description: "Failed to delete theme (it might be in use)", variant: "destructive" });
    }
  };

  if (isLoading) return <div>{i18n.t("common.loading")}</div>;
  if (error) return <div>{i18n.t("themes.error.loadingError")}</div>;

  return (
    <div className={`container mx-auto px-4 py-8 ${darkMode ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-6">{i18n.t("themes.manageThemes")}</h1>
      <button onClick={handleAddTheme} className="mb-4 px-4 py-2 bg-blue-500 text-white rounded flex items-center">
        <Plus className="h-4 w-4 mr-2" />
        {i18n.t("themes.addTheme")}
      </button>
      <div className="themes-container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {themes?.map((theme: Theme) => (
          <Card key={theme.id} className="mb-4 hover-scale h-full bg-white dark:bg-gray-700">
            <CardHeader>
              <CardTitle className="theme-card-title text-gray-900 dark:text-gray-100">
                 {theme.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                {theme.description}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Color: <span style={{ color: theme.color }}>{theme.color}</span>
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Created at: {new Date(theme.created_at).toLocaleString()}
              </p>
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => setEditingTheme(theme)}
                  className="flex items-center px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleRemoveTheme(theme.id)}
                  className="flex items-center px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editingTheme && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
          <div className="bg-white dark:bg-gray-700 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">{i18n.t("themes.editTheme")}</h2>
            <input
              type="text"
              value={editingTheme.name}
              onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
              className="mb-2 p-2 border rounded w-full bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
            />
            <textarea
              value={editingTheme.description}
              onChange={(e) => setEditingTheme({ ...editingTheme, description: e.target.value })}
              className="mb-2 p-2 border rounded w-full bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={() => handleEditTheme(editingTheme)}
              className="mt-2 px-4 py-2 bg-green-500 text-white rounded"
            >
              {i18n.t("themes.saveTheme")}
            </button>
            <button
              onClick={() => setEditingTheme(null)}
              className="mt-2 px-4 py-2 bg-gray-500 text-white rounded"
            >
              {i18n.t("themes.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeManager;