import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { themeApi } from '@/api/themes.api';
import { Theme } from '@/types/Theme';
import { Story } from '@/types/Story';
import { useThemes, useThemeMutations } from '@/hooks/useThemes';

export interface ThemeContextType {
  // State
  themes: Theme[];
  loading: boolean;
  error: string | null;
  editingTheme: Theme | null;
  selectedThemeId: string | null;
  expandedThemeId: string | null;
  storiesUsingTheme: Story[];
  filterName: string;
  filterAge: string;
  filterSeries: string;
  sortOrder: 'asc' | 'desc';
  newTheme: Theme;

  // Actions
  setThemes: (themes: Theme[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setEditingTheme: (theme: Theme | null) => void;
  setSelectedThemeId: (id: string | null) => void;
  setExpandedThemeId: (id: string | null) => void;
  setStoriesUsingTheme: (stories: Story[]) => void;
  setFilterName: (name: string) => void;
  setFilterAge: (age: string) => void;
  setFilterSeries: (seriesId: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setNewTheme: (theme: Theme) => void;

  // Complex actions
  fetchThemes: () => Promise<void>;
  fetchStoriesUsingTheme: (themeId: string) => Promise<void>;
  addTheme: (theme: Theme) => Promise<void>;
  editTheme: (theme: Theme) => Promise<void>;
  removeTheme: (id: string) => Promise<void>;
  resetNewTheme: () => void;
  resetForm: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Filter States
  const [filterName, setFilterName] = useState('');
  const [filterAge, setFilterAge] = useState<string>('all');
  const [filterSeries, setFilterSeries] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // UI States
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);
  const [storiesUsingTheme, setStoriesUsingTheme] = useState<Story[]>([]);
  const [manualError, setManualError] = useState<string | null>(null);

  const [newTheme, setNewTheme] = useState<Theme>({
    id: '',
    name: '',
    description: '',
    color: '#8b5cf6',
    created_at: '',
  });

  // React Query Integration
  const { 
    data: fetchedThemes = [], 
    isLoading: isThemesLoading, 
    error: themesError, 
    refetch 
  } = useThemes({
    search: filterName,
    age_group: filterAge !== 'all' ? filterAge : undefined,
    series_id: filterSeries !== 'all' ? filterSeries : undefined
  });

  const { createTheme, updateTheme, deleteTheme } = useThemeMutations();

  // Derived State
  const loading = isThemesLoading;
  const error = manualError || (themesError ? (themesError as Error).message : null);
  const themes = fetchedThemes as Theme[];

  // wrapper for compatibility
  const fetchThemes = useCallback(async () => {
     await refetch();
  }, [refetch]);

  const fetchStoriesUsingTheme = useCallback(async (themeId: string) => {
    try {
      setStoriesUsingTheme([]); // Clear previous stories immediately
      const data = (await themeApi.getStories(themeId)) as any;
      setStoriesUsingTheme(data);
    } catch (err) {
      console.error('Error fetching stories using theme:', err);
      setStoriesUsingTheme([]);
      throw err;
    }
  }, []);

  const addThemeAction = useCallback(async (theme: Theme) => {
    try {
      await createTheme.mutateAsync(theme);
      resetNewTheme();
      setManualError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add theme';
      setManualError(errorMessage);
      throw err;
    }
  }, [createTheme]);

  const editThemeAction = useCallback(async (theme: Theme) => {
    try {
      await updateTheme.mutateAsync({ id: theme.id, data: theme });
      setEditingTheme(null);
      setSelectedThemeId(null);
      setManualError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to edit theme';
      setManualError(errorMessage);
      throw err;
    }
  }, [updateTheme]);

  const removeThemeAction = useCallback(async (id: string) => {
    try {
      setSelectedThemeId(id);
      // Check for usage
      const stories = (await themeApi.getStories(id)) as any;
      if (stories.length > 0) {
           throw new Error('Theme has stories using it');
      }

      await deleteTheme.mutateAsync(id);
      setManualError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove theme';
      setManualError(errorMessage);
      throw err;
    } finally {
      resetForm();
    }
  }, [deleteTheme]);

  const resetNewTheme = useCallback(() => {
    setNewTheme({
      id: '',
      name: '',
      description: '',
      color: '#8b5cf6',
      created_at: '',
    });
  }, []);

  const resetForm = useCallback(() => {
    setEditingTheme(null);
    setSelectedThemeId(null);
    setExpandedThemeId(null);
    setStoriesUsingTheme([]);
  }, []);

  const value: ThemeContextType = {
    themes,
    loading,
    error,
    editingTheme,
    selectedThemeId,
    expandedThemeId,
    storiesUsingTheme,
    filterName,
    filterAge,
    filterSeries,
    sortOrder,
    newTheme,
    setThemes: () => {}, // No-op, managed by Query
    setLoading: () => {}, // No-op
    setError: setManualError,
    setEditingTheme,
    setSelectedThemeId,
    setExpandedThemeId,
    setStoriesUsingTheme,
    setFilterName,
    setFilterAge,
    setFilterSeries,
    setSortOrder,
    setNewTheme,
    fetchThemes,
    fetchStoriesUsingTheme,
    addTheme: addThemeAction,
    editTheme: editThemeAction,
    removeTheme: removeThemeAction,
    resetNewTheme,
    resetForm,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
};
