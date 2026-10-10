import { useState } from 'react';

const STORAGE_KEY = 'reading.textSize';

/** Text sizes of the story page, smallest first. */
export const TEXT_SIZES = ['text-base', 'text-lg', 'text-xl'] as const;
const DEFAULT_SIZE = 1;

const clampSize = (size: number) => Math.min(TEXT_SIZES.length - 1, Math.max(0, size));

const readSize = () => {
    try {
        const stored = Number(localStorage.getItem(STORAGE_KEY));
        return Number.isInteger(stored) && localStorage.getItem(STORAGE_KEY) !== null ? clampSize(stored) : DEFAULT_SIZE;
    } catch {
        return DEFAULT_SIZE;
    }
};

/**
 * Text size of the story page (A- / A+), remembered in this browser.
 */
export const useReadingPrefs = () => {
    const [size, setSize] = useState(readSize);

    const change = (delta: number) => {
        const next = clampSize(size + delta);
        setSize(next);
        try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* storage unavailable: kept for this visit */ }
    };

    return {
        textSizeClass: TEXT_SIZES[size],
        canShrink: size > 0,
        canGrow: size < TEXT_SIZES.length - 1,
        shrink: () => change(-1),
        grow: () => change(1),
    };
};
