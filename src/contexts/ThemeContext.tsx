import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { themeApi } from '@/api/themes.api';
import { Theme } from '@/types/Theme';
import { Story } from '@/types/Story';

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
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);
  const [storiesUsingTheme, setStoriesUsingTheme] = useState<Story[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterAge, setFilterAge] = useState<string>('all');
  const [filterSeries, setFilterSeries] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [newTheme, setNewTheme] = useState<Theme>({
    id: '',
    name: '',
    description: '',
    color: '#8b5cf6',
    created_at: '',
  });

  const fetchThemes = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (filterName) filters.search = filterName;
      if (filterAge && filterAge !== 'all') filters.age_group = filterAge;
      if (filterSeries && filterSeries !== 'all') filters.series_id = filterSeries;

      const data = await themeApi.getAll(filters);
      setThemes(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch themes';
      setError(errorMessage);
      console.error('Error fetching themes:', err);
    } finally {
      setLoading(false);
    }
  }, [filterName, filterAge, filterSeries]);

  const fetchStoriesUsingTheme = useCallback(async (themeId: string) => {
    try {
      const data = (await themeApi.getStories(themeId)) as any;
      setStoriesUsingTheme(data);
    } catch (err) {
      console.error('Error fetching stories using theme:', err);
      setStoriesUsingTheme([]);
      throw err;
    }
  }, []);

  const addTheme = useCallback(async (theme: Theme) => {
    try {
      setLoading(true);
      const data = (await themeApi.create(theme)) as any;
      setThemes((prevThemes) => [...prevThemes, data]);
      resetNewTheme();
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add theme';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const editTheme = useCallback(async (theme: Theme) => {
    try {
      setLoading(true);
      const data = (await themeApi.update(theme.id, theme)) as any;
      setThemes((prevThemes) =>
        prevThemes.map((t) => (t.id === theme.id ? data : t))
      );
      setEditingTheme(null);
      setSelectedThemeId(null);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to edit theme';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTheme = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setSelectedThemeId(id);
      await fetchStoriesUsingTheme(id);

      // Note: validation logic (storiesUsingTheme check) might be race-prone if state not updated immediately.
      // Ideally, the backend should prevent deletion if used.
      // But keeping logic as is:
      
      // We need to wait for state update? No, state update is async.
      // The original code waited for fetchStoriesUsingTheme which updates state.
      // But we can't read state immediately after.
      // However, the original code DID attempt to read state. CHECK THIS.
      // Original: await fetchStoriesUsingTheme(id); if (storiesUsingTheme.length > 0) ...
      // This is a BUG in original code because React state updates are scheduled, not immediate.
      // I will fix this by checking the RETURN VALUE of fetchStoriesUsingTheme instead of state.
      // But my new fetchStoriesUsingTheme doesn't return data. I should modify it to return data.
      
      // Actually, let's just make the API call to check.
      const stories = (await themeApi.getStories(id)) as any;
      if (stories.length > 0) {
           throw new Error('Theme has stories using it');
      }

      await themeApi.delete(id);

      setThemes((prevThemes) => prevThemes.filter((theme) => theme.id !== id));
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove theme';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
      resetForm();
    }
  }, []);

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
    setThemes,
    setLoading,
    setError,
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
    addTheme,
    editTheme,
    removeTheme,
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
