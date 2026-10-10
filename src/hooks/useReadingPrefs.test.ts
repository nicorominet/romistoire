import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReadingPrefs } from './useReadingPrefs';

describe('useReadingPrefs', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('starts medium, stays within the sizes and remembers the choice', () => {
        const { result } = renderHook(() => useReadingPrefs());
        expect(result.current.textSizeClass).toBe('text-lg');

        act(() => result.current.grow());
        act(() => result.current.grow());
        expect(result.current.textSizeClass).toBe('text-xl');
        expect(result.current.canGrow).toBe(false);

        const again = renderHook(() => useReadingPrefs());
        expect(again.result.current.textSizeClass).toBe('text-xl');

        act(() => again.result.current.shrink());
        act(() => again.result.current.shrink());
        act(() => again.result.current.shrink());
        expect(again.result.current.textSizeClass).toBe('text-base');
        expect(again.result.current.canShrink).toBe(false);
    });

    it('works without storage', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

        const { result } = renderHook(() => useReadingPrefs());
        act(() => result.current.grow());

        expect(result.current.textSizeClass).toBe('text-xl');
    });
});
