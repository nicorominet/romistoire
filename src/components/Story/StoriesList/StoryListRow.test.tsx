import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StoryListRow from './StoryListRow';
import { Story } from '@/types/Story';

vi.mock('@/lib/i18n', () => ({
    i18n: {
        t: (key: string) => key,
        getCurrentLocale: () => 'fr'
    }
}));

vi.mock('@/components/ui/SafeImage', () => ({
    default: ({ src, className }: any) => <img src={src} alt="" className={className} data-testid="safe-image" />
}));

const story = {
    id: '42',
    title: 'La graine mystérieuse',
    content: 'Il était une fois',
    age_group: '4-6',
    locale: 'fr',
    created_at: '2026-10-01T10:00:00Z',
    modified_at: '2026-10-02T10:00:00Z',
    week_number: 41,
    day_order: 1,
    version: 1,
    source: 'gemini',
    is_manually_edited: false,
    themes: [],
    illustrations: [],
} as Story;

const renderRow = (value: Story) => render(
    <MemoryRouter>
        <ul><StoryListRow story={value} /></ul>
    </MemoryRouter>
);

describe('StoryListRow', () => {
    it('links to the story and tells where it sits in the program', () => {
        renderRow(story);

        expect(screen.getByRole('link')).toHaveAttribute('href', '/stories/42');
        expect(screen.getByText('La graine mystérieuse')).toBeInTheDocument();
        expect(screen.getByText(/ages\.4-6 · story\.week 41 · days\.monday/)).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: 'story.hasAudio' })).not.toBeInTheDocument();
    });

    it('shows the audio, the illustration and the review state', () => {
        renderRow({
            ...story,
            audio_path: '/uploads/audio/42.wav',
            review_status: 'to_review',
            illustrations: [{ id: 'i1', story_id: '42', image_path: 'uploads/i1.png' }],
        });

        expect(screen.getByRole('img', { name: 'story.hasAudio' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'stories.withImage' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'review.toReview' })).toBeInTheDocument();
        expect(screen.getByTestId('safe-image')).toHaveAttribute('src', '/uploads/i1.png');
    });
});
