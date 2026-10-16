export declare const normalizeThemeName: (name: string | null | undefined) => string;
export declare const isSameThemeName: (a: string, b: string) => boolean;
export declare const findSimilarThemes: <T extends { name: string }>(name: string, themes: T[]) => T[];
export declare const groupSimilarThemes: <T extends { name: string }>(themes: T[]) => T[][];
export declare const matchesThemeSearch: (name: string, term: string) => boolean;
