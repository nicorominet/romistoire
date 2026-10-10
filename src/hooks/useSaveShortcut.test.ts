import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSaveShortcut } from './useSaveShortcut';

const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { key: 's', cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
};

describe('useSaveShortcut', () => {
    it('saves on Ctrl+S and Cmd+S instead of the browser dialog', () => {
        const onSave = vi.fn();
        renderHook(() => useSaveShortcut(onSave));

        expect(press({ ctrlKey: true }).defaultPrevented).toBe(true);
        press({ metaKey: true, key: 'S' });
        expect(onSave).toHaveBeenCalledTimes(2);
    });

    it('ignores other keys', () => {
        const onSave = vi.fn();
        renderHook(() => useSaveShortcut(onSave));

        press({});
        press({ ctrlKey: true, key: 'a' });
        expect(onSave).not.toHaveBeenCalled();
    });

    it('does nothing while disabled, but still blocks the browser dialog', () => {
        const onSave = vi.fn();
        renderHook(() => useSaveShortcut(onSave, false));

        expect(press({ ctrlKey: true }).defaultPrevented).toBe(true);
        expect(onSave).not.toHaveBeenCalled();
    });
});
