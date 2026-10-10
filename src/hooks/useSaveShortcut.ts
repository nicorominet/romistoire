import { useEffect, useRef } from 'react';

/**
 * Ctrl+S / Cmd+S runs `onSave` instead of the browser's "save the page", also while typing in the editor.
 * @param onSave - Latest callback is always used.
 * @param enabled - False while saving (the shortcut then does nothing, the browser dialog stays blocked).
 */
export const useSaveShortcut = (onSave: () => void, enabled = true) => {
    const saveRef = useRef(onSave);
    saveRef.current = onSave;

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return;
            event.preventDefault();
            if (enabled) saveRef.current();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled]);
};
