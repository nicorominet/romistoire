import { describe, expect, it } from 'vitest';
import { findSlotConflict } from './SlotConflictNotice';
import { Story } from '@/types/Story';

const story = (id: string, series_name?: string) => ({ id, title: id, series_name }) as Story;

describe('findSlotConflict', () => {
    it('finds another story of the same series in the slot', () => {
        expect(findSlotConflict([story('other', 'Léonie')], 'mine', 'Léonie')?.id).toBe('other');
        // No series on both sides is the same "series"
        expect(findSlotConflict([story('other')], undefined, '')?.id).toBe('other');
    });

    it('ignores the story itself and the other series', () => {
        expect(findSlotConflict([story('mine', 'Léonie')], 'mine', 'Léonie')).toBeUndefined();
        expect(findSlotConflict([story('other', 'Antonin')], 'mine', 'Léonie')).toBeUndefined();
        expect(findSlotConflict([story('other', 'Léonie')], 'mine', '')).toBeUndefined();
    });
});
