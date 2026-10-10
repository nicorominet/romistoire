import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StorySidePanel from './StorySidePanel';
import { Story } from '@/types/Story';

vi.mock('@/lib/i18n', () => ({
    i18n: { t: (key: string) => key, getCurrentLocale: () => 'fr' }
}));
// Its own data (settings) is not under test here
vi.mock('./AudioGenerateButton', () => ({ default: () => <button type="button">generate-audio</button> }));
vi.mock('@/components/Story/IllustrationPromptCard', () => ({ default: () => <div>illustration-prompt</div> }));

const story = {
    id: '42', title: 'La graine', content: '', age_group: '4-6', locale: 'fr',
    created_at: '2026-10-01T10:00:00Z', modified_at: '2026-10-02T10:00:00Z',
    week_number: 41, day_order: 1, version: 2, source: 'gemini', is_manually_edited: false,
    themes: [], illustrations: [], series_id: 's1', series_name: 'Léonie',
} as Story;

const renderPanel = (value: Story) => render(
    <MemoryRouter>
        <StorySidePanel story={value} weekTopic="Les citrouilles" audioPending={false} onGenerateAudio={vi.fn()} />
    </MemoryRouter>
);

describe('StorySidePanel', () => {
    it('says there is no audio yet, and offers to generate it', () => {
        const { container } = renderPanel(story);

        expect(screen.getByText('story.detail.noAudio')).toBeInTheDocument();
        expect(container.querySelector('audio')).toBeNull();
        expect(screen.getByText('generate-audio')).toBeInTheDocument();
    });

    it('plays the audio when there is one', () => {
        const { container } = renderPanel({ ...story, audio_path: '/uploads/audio/42.wav' });

        expect(container.querySelector('audio source')).toHaveAttribute('src', '/uploads/audio/42.wav');
        expect(screen.queryByText('story.detail.noAudio')).not.toBeInTheDocument();
    });

    it('shows the program with links, the illustration to make, and folds the details', () => {
        const { container } = renderPanel(story);

        expect(screen.getByRole('link', { name: '41' })).toHaveAttribute('href', '/stories?weekNumber=41');
        expect(screen.getByRole('link', { name: 'Léonie' })).toHaveAttribute('href', '/stories?seriesId=s1');
        expect(screen.getByText('Les citrouilles')).toBeInTheDocument();
        expect(screen.getByText('illustration-prompt')).toBeInTheDocument();
        expect(container.querySelector('details')).not.toHaveAttribute('open');
    });
});
