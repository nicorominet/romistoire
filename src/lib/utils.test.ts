// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { cn, getAgeGroupColor, stripHtmlTags, formatDate, truncateText } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('c1', 'c2')).toBe('c1 c2');
    });

    it('should handle conditional classes', () => {
      expect(cn('c1', true && 'c2', false && 'c3')).toBe('c1 c2');
    });

    it('should merge tailwind classes', () => {
      // twMerge should override conflicting classes
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });
  });

  describe('getAgeGroupColor', () => {
    it('should return correct colors for known age groups', () => {
      expect(getAgeGroupColor('2-3')).toContain('bg-green-100');
      expect(getAgeGroupColor('4-6')).toContain('bg-blue-100');
    });

    it('should return default color for unknown age group', () => {
      expect(getAgeGroupColor('unknown')).toContain('bg-gray-100');
    });
  });

  describe('stripHtmlTags', () => {
    it('should remove simple tags', () => {
      expect(stripHtmlTags('<p>Hello</p>')).toBe('Hello');
    });

    it('should remove nested tags', () => {
      expect(stripHtmlTags('<div><p>Hello <b>World</b></p></div>')).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(stripHtmlTags('')).toBe('');
    });

    it('should handle strings without tags', () => {
      expect(stripHtmlTags('Hello World')).toBe('Hello World');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly for FR locale by default', () => {
      // Note: Date formatting might depend on system timezone if not handling specific UTC dates.
      // We'll test with a specific date and expected output structure or parts.
      // Using a fixed date: 2023-01-15
      const date = new Date('2023-01-15T12:00:00Z');
      const formatted = formatDate(date);
      // Expected format "15 janv. 2023" or similar depending on environment node locale data
      // We check for parts to be safe against slight locale varations
      expect(formatted).toMatch(/15/);
      expect(formatted).toMatch(/2023/);
    });

    it('should support other locales', () => {
       const date = new Date('2023-01-15T12:00:00Z');
       const formatted = formatDate(date, 'en-US');
       expect(formatted).toMatch(/Jan/);
       expect(formatted).toMatch(/15/);
       expect(formatted).toMatch(/2023/);
    });
  });

  describe('truncateText', () => {
    it('should truncate text longer than max length', () => {
      expect(truncateText('Hello World', 5)).toBe('Hello...');
    });

    it('should not truncate text shorter than max length', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should not truncate text equal to max length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });
  });
});
