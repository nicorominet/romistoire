import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VersionHistory from './VersionHistory';
import { StoryVersion } from '@/types/Story';

vi.mock('@/lib/i18n', () => ({
    i18n: { t: (key: string) => key, getCurrentLocale: () => 'fr' }
}));

const version = (n: number, title: string, content: string): StoryVersion => ({
    id: `v${n}`, story_id: 's', title, content, themes: [], ageGroup: '4-6',
    createdAt: `2026-10-0${n}T10:00:00Z`, version: n, isManuallyEdited: false,
});

const versions = [
    version(1, 'Première', '<p>Il était une fois.</p><p>Fin.</p>'),
    version(3, 'Troisième', '<p>Dernier texte</p>'),
    version(2, 'Deuxième', '<p>Autre texte</p>'),
];

const current = { title: 'Première', content: '<p>Il était deux fois.</p><p>Fin.</p>', ageGroup: '4-6', themes: [] };

describe('VersionHistory', () => {
    it('lists the versions newest first', () => {
        render(<VersionHistory versions={versions} current={current} onRestore={vi.fn()} saving={false} hasUnsavedChanges={false} />);

        const titles = screen.getAllByRole('listitem').map((item) => within(item).getByText(/ième|Première/).textContent);
        expect(titles).toEqual(['Troisième', 'Deuxième', 'Première']);
    });

    it('shows what restoring would change, then the version in full, before restoring it', () => {
        const onRestore = vi.fn();
        render(<VersionHistory versions={versions} current={current} onRestore={onRestore} saving={false} hasUnsavedChanges />);

        fireEvent.click(screen.getAllByRole('button', { name: /editor\.history\.view/ })[2]);

        const dialog = screen.getByRole('dialog');
        // Opens on the differences with the saved story: "deux" would disappear, "une" come back
        expect(within(dialog).getByText('deux')).toHaveClass('line-through');
        expect(within(dialog).getByText('une')).toHaveClass('bg-emerald-100');
        // Full text in the other tab
        fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'editor.diff.fullText' }));
        expect(within(dialog).getByText('Il était une fois.')).toBeInTheDocument();
        expect(within(dialog).getByText('Fin.')).toBeInTheDocument();
        expect(within(dialog).getByText('story.restoreUnsavedWarning')).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: /editor\.history\.restore/ }));
        expect(onRestore).toHaveBeenCalledWith('v1');
    });

    it('says when there is no other version', () => {
        render(<VersionHistory versions={[]} current={current} onRestore={vi.fn()} saving={false} hasUnsavedChanges={false} />);

        expect(screen.getByText('editor.history.empty')).toBeInTheDocument();
    });
});
