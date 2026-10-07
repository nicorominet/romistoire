/**
 * Theme color helpers: every badge derives its colors from the theme color with these rules,
 * so any color stays readable in light and dark mode.
 */

export const FALLBACK_THEME_COLOR = '#6366f1';

/** Readable on white and on dark backgrounds (tinted badges). */
export const THEME_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a16207', '#64748b',
] as const;

/** "#abc" / "#aabbcc" -> [r, g, b], or null for an invalid code. */
export const parseHexColor = (hex: string | null | undefined): [number, number, number] | null => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return null;
  const value = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1];
  return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
};

/** Valid "#rrggbb" color, or the fallback. */
export const safeThemeColor = (hex: string | null | undefined): string => {
  const rgb = parseHexColor(hex);
  return rgb ? `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}` : FALLBACK_THEME_COLOR;
};

/** WCAG relative luminance (0 = black, 1 = white). */
export const luminance = (hex: string): number => {
  const rgb = parseHexColor(hex) ?? parseHexColor(FALLBACK_THEME_COLOR)!;
  const [r, g, b] = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Black or white, whichever reads best on a solid `hex` background. */
export const readableTextColor = (hex: string): '#000000' | '#ffffff' => {
  const contrastWithWhite = 1.05 / (luminance(hex) + 0.05);
  const contrastWithBlack = (luminance(hex) + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
};

/** `hex` with transparency, e.g. tint("#4CAF50", 0.12) -> "rgba(76, 175, 80, 0.12)". */
export const tint = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHexColor(hex) ?? parseHexColor(FALLBACK_THEME_COLOR)!;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Colors of a theme badge.
 * - solid: theme color background, black or white text.
 * - soft: tinted background, text in the theme color (darkened when too light to read on white).
 */
export const themeBadgeStyle = (color: string | null | undefined, variant: 'solid' | 'soft' = 'soft') => {
  const base = safeThemeColor(color);
  if (variant === 'solid') {
    return { backgroundColor: base, color: readableTextColor(base), borderColor: base };
  }
  // Very light colors (yellow, white...) would vanish as text: use a darker text instead
  const text = luminance(base) > 0.45 ? `color-mix(in srgb, ${base} 45%, #000)` : base;
  return { backgroundColor: tint(base, 0.14), color: text, borderColor: tint(base, 0.35) };
};
