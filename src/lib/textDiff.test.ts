import { describe, expect, it } from 'vitest';
import { diffStats, diffWords, PARAGRAPH, storyTokens } from './textDiff';

const words = (text: string) => text.split(' ');

describe('textDiff', () => {
    it('cuts stories into words with the paragraph breaks', () => {
        expect(storyTokens('<p>Il était</p><p>une <strong>fois</strong></p>')).toEqual(['Il', 'était', PARAGRAPH, 'une', 'fois']);
        expect(storyTokens('')).toEqual([]);
    });

    it('marks the words removed and added, the rest unchanged', () => {
        const parts = diffWords(words('le petit renard dort'), words('le grand renard dort bien'));

        expect(parts).toEqual([
            { type: 'same', text: 'le' },
            { type: 'removed', text: 'petit' },
            { type: 'added', text: 'grand' },
            { type: 'same', text: 'renard dort' },
            { type: 'added', text: 'bien' },
        ]);
        expect(diffStats(parts)).toEqual({ added: 2, removed: 1 });
    });

    it('gives one unchanged part for identical texts', () => {
        expect(diffWords(words('a b c'), words('a b c'))).toEqual([{ type: 'same', text: 'a b c' }]);
    });

    it('keeps the paragraph breaks in the parts', () => {
        const parts = diffWords(['a', PARAGRAPH, 'b'], ['a', PARAGRAPH, 'c']);
        expect(parts[0]).toEqual({ type: 'same', text: `a${PARAGRAPH}` });
        expect(parts.slice(1)).toEqual([{ type: 'removed', text: 'b' }, { type: 'added', text: 'c' }]);
    });

    it('handles a whole story quickly', () => {
        const story = Array.from({ length: 1500 }, (_, i) => `mot${i % 300}`);
        const edited = [...story.slice(0, 700), 'nouveau', ...story.slice(720)];

        const started = performance.now();
        const stats = diffStats(diffWords(story, edited));

        expect(stats).toEqual({ added: 1, removed: 20 });
        expect(performance.now() - started).toBeLessThan(500);
    });
});
