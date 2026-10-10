import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StoryDetailPage from './StoryDetailPage';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

vi.mock('@/lib/i18n', () => ({
    i18n: { t: (key: string) => key, getCurrentLocale: () => 'fr' }
}));
// Layout, side panel and content have their own data: only the page logic is under test
vi.mock('@/components/Layout/PageLayout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/Story/StoryDetail/StorySidePanel', () => ({ default: () => <aside>panel</aside> }));
vi.mock('@/components/Story/StoryDetail/StoryContent', () => ({ default: () => <p>story text</p> }));

const story = {
    id: 'cur', title: 'La graine', content: 'Il était une fois', age_group: '4-6', locale: 'fr',
    created_at: '', modified_at: '', week_number: 41, day_order: 2, version: 1, source: 'gemini',
    is_manually_edited: false, themes: [], illustrations: [], review_status: 'to_review',
};
vi.mock('@/hooks/useStory', () => ({
    useStory: () => ({ data: story, isLoading: false, error: null }),
    useStoryNeighbors: () => ({ data: { prev: { id: 'prev', title: 'Lundi', week_number: 41, day_order: 1 }, next: { id: 'next', title: 'Mercredi', week_number: 41, day_order: 3 } } }),
    useStoryMutations: () => ({
        deleteStory: { mutateAsync: vi.fn() },
        generateAudio: { mutateAsync: vi.fn(), isPending: false },
        validateStory: { mutate: vi.fn(), isPending: false },
    }),
}));
vi.mock('@/hooks/useThemes', () => ({ useWeeklyThemes: () => ({ data: [] }) }));

const renderPage = (url = '/stories/cur') => render(
    <MemoryRouter initialEntries={[url]}>
        <Routes>
            <Route path="/stories/:id" element={<StoryDetailPage />} />
        </Routes>
    </MemoryRouter>
);

describe('StoryDetailPage', () => {
    beforeEach(() => navigate.mockClear());

    it('goes to the previous and next stories with the arrow keys', () => {
        renderPage();

        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(navigate).toHaveBeenLastCalledWith('/stories/next');
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        expect(navigate).toHaveBeenLastCalledWith('/stories/prev');
    });

    it('leaves the arrow keys to a field being typed in', () => {
        renderPage();
        const input = document.createElement('input');
        document.body.appendChild(input);

        fireEvent.keyDown(input, { key: 'ArrowRight' });

        expect(navigate).not.toHaveBeenCalled();
        input.remove();
    });

    it('keeps the reading mode when changing story, without the menus and panel', () => {
        renderPage('/stories/cur?read=1');

        expect(screen.queryByText('panel')).not.toBeInTheDocument();
        expect(screen.getByText('story.detail.exitReading')).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(navigate).toHaveBeenLastCalledWith('/stories/next?read=1');
    });

    it('shows that the story waits for a review', () => {
        renderPage();

        expect(screen.getByText('story.detail.toReview')).toBeInTheDocument();
        expect(screen.getByText('panel')).toBeInTheDocument();
    });
});
