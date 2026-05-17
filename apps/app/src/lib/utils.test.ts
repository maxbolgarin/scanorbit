import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  formatCurrency,
  formatNumber,
  truncate,
  getInitials,
} from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });
});

describe('formatDate', () => {
  it('formats a Date object', () => {
    const result = formatDate(new Date('2024-06-15T12:00:00Z'));
    expect(result).toBe('Jun 15, 2024');
  });

  it('formats a date string', () => {
    const result = formatDate('2024-01-01T00:00:00Z');
    expect(result).toBe('Jan 1, 2024');
  });

  it('formats another date string', () => {
    const result = formatDate('2023-12-25T00:00:00Z');
    expect(result).toBe('Dec 25, 2023');
  });
});

describe('formatDateTime', () => {
  it('formats a Date object with time', () => {
    const result = formatDateTime(new Date('2024-06-15T14:30:00Z'));
    // Contains both date and time parts
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for less than a minute ago', () => {
    const thirtySecondsAgo = new Date('2024-06-15T11:59:31Z');
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinutesAgo = new Date('2024-06-15T11:55:00Z');
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date('2024-06-15T09:00:00Z');
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago for less than 7 days', () => {
    const twoDaysAgo = new Date('2024-06-13T12:00:00Z');
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });

  it('falls back to formatted date for 7+ days', () => {
    const tenDaysAgo = new Date('2024-06-05T12:00:00Z');
    expect(formatRelativeTime(tenDaysAgo)).toBe('Jun 5, 2024');
  });

  it('handles string input', () => {
    expect(formatRelativeTime('2024-06-15T11:58:00Z')).toBe('2m ago');
  });

  it('returns "just now" for 0 seconds ago', () => {
    expect(formatRelativeTime('2024-06-15T12:00:00Z')).toBe('just now');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats 0 milliseconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('formats minutes only when no remaining seconds', () => {
    expect(formatDuration(120000)).toBe('2m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(5400000)).toBe('1h 30m');
  });

  it('formats hours only when no remaining minutes', () => {
    expect(formatDuration(7200000)).toBe('2h');
  });

  it('formats sub-second durations as 0s', () => {
    expect(formatDuration(500)).toBe('0s');
  });
});

describe('formatCurrency', () => {
  it('formats with default EUR currency', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1,234.56');
  });

  it('formats with USD currency', () => {
    const result = formatCurrency(99.99, 'USD');
    expect(result).toBe('$99.99');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0.00');
  });

  it('formats negative amounts', () => {
    const result = formatCurrency(-50, 'USD');
    expect(result).toContain('50.00');
  });
});

describe('formatNumber', () => {
  it('formats large numbers with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats small numbers without commas', () => {
    expect(formatNumber(42)).toBe('42');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('truncate', () => {
  it('returns the string if shorter than length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns the string if equal to length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis if longer', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('truncates to 0 length', () => {
    expect(truncate('hello', 0)).toBe('...');
  });
});

describe('getInitials', () => {
  it('extracts initials from two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('extracts initials from single word', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('limits to 2 characters for long names', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('uppercases initials', () => {
    expect(getInitials('john doe')).toBe('JD');
  });
});
