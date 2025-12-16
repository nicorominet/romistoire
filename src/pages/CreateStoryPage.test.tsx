import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreateStoryPage from './CreateStoryPage';
import { themeApi, weeklyThemeApi } from '@/api/themes.api';
import { seriesApi, storyApi } from '@/api/stories.api';

// Mock dependencies
vi.mock('@/lib/i18n', () => ({
    i18n: {
        t: (key: string) => key,
        getCurrentLocale: () => 'fr',
        getAvailableLocales: () => [{ code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }],
        setLocale: vi.fn(),
        subscribe: vi.fn(() => () => {})
    }
}));

vi.mock('@/api/themes.api', () => ({
    themeApi: {
        getAll: vi.fn()
    },
    weeklyThemeApi: {
        getAll: vi.fn()
    }
}));

vi.mock('@/api/stories.api', () => ({
    seriesApi: {
        getAll: vi.fn()
    },
    storyApi: {
        create: vi.fn()
    }
}));

vi.mock('@/api/system.api', () => ({
    systemApi: {
        uploadImage: vi.fn()
    }
}));

// Mock UI components that might cause issues in JSDOM or are not the focus
// We keep basic structure to allow finding elements
vi.mock('@/components/ui/sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock complex child components to simplify integration test
// We want to test the PAGE logic (data loading, submission), not the inner workings of complex editors
// But we need inputs to be accessible
vi.mock('@/components/Story/StoryEditor/StoryContent', () => ({
    default: () => <div data-testid="story-content-editor">
        <input name="title" placeholder="Title" onChange={(e) => {}} /> 
        <textarea name="content" placeholder="Content"></textarea>
    </div>
}));

// Actually, CreateStoryPage uses `useFormContext` in children. 
// If we mock Children, they won't be connected to the form unless we manually connect them or usage is simple.
// The real StoryContent uses `useFormContext`.
// If we mock it, we break the form connection unless the mock uses useFormContext too.
// Let's rely on real components if possible, or simple mocks that use the context if we really need to.
// However, `CreateStoryPage` wraps them in `FormProvider`.
// So real components should work if they are rendered.

describe('CreateStoryPage', () => {
    const mockThemes = [
        { id: 't1', name: 'Adventure', description: 'Desc', color: '#fff', created_at: '' }
    ];
    const mockWeeklyThemes = [];
    const mockSeries = [];
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        (themeApi.getAll as any).mockResolvedValue(mockThemes);
        (weeklyThemeApi.getAll as any).mockResolvedValue(mockWeeklyThemes);
        (seriesApi.getAll as any).mockResolvedValue(mockSeries);
    });

    it('renders and loads initial data', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <CreateStoryPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(themeApi.getAll).toHaveBeenCalled();
        });

        // Check for main elements
        expect(screen.getByText('create.title')).toBeInTheDocument();
        expect(screen.getByText('create.tabs.write')).toBeInTheDocument();
    });

    // NOTE: Testing actual form submission is tricky with complex nested form components 
    // and TipTap editor which is hard to test in JSDOM without extensive mocks.
    // For this "Integration Test", verifying data load and page render is a good first step.
    // We can try a simple submission if we can access the inputs.
    // The `StoryContent` component is the one holding inputs.
});
