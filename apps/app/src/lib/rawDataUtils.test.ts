import { describe, it, expect } from 'vitest';
import {
  getString,
  getNumber,
  getBoolean,
  getArray,
  getObject,
  getNestedString,
  getNestedNumber,
  getNestedBoolean,
  formatBytes,
  formatGiB,
  formatMiB,
  formatSeconds,
} from './rawDataUtils';

describe('getString', () => {
  it('returns string value for valid key', () => {
    expect(getString({ name: 'test' }, 'name')).toBe('test');
  });

  it('returns null for non-string value', () => {
    expect(getString({ count: 42 }, 'count')).toBeNull();
  });

  it('returns null for missing key', () => {
    expect(getString({ a: 'b' }, 'missing')).toBeNull();
  });

  it('returns null for null object', () => {
    expect(getString(null, 'key')).toBeNull();
  });

  it('returns null for undefined object', () => {
    expect(getString(undefined, 'key')).toBeNull();
  });

  it('returns empty string for empty string value', () => {
    expect(getString({ name: '' }, 'name')).toBe('');
  });
});

describe('getNumber', () => {
  it('returns number value for valid key', () => {
    expect(getNumber({ count: 42 }, 'count')).toBe(42);
  });

  it('returns null for non-number value', () => {
    expect(getNumber({ count: '42' }, 'count')).toBeNull();
  });

  it('returns null for null object', () => {
    expect(getNumber(null, 'key')).toBeNull();
  });

  it('returns null for undefined object', () => {
    expect(getNumber(undefined, 'key')).toBeNull();
  });

  it('returns 0 for zero value', () => {
    expect(getNumber({ count: 0 }, 'count')).toBe(0);
  });
});

describe('getBoolean', () => {
  it('returns true for boolean true', () => {
    expect(getBoolean({ active: true }, 'active')).toBe(true);
  });

  it('returns false for boolean false', () => {
    expect(getBoolean({ active: false }, 'active')).toBe(false);
  });

  it('returns null for non-boolean value', () => {
    expect(getBoolean({ active: 'yes' }, 'active')).toBeNull();
  });

  it('returns null for null object', () => {
    expect(getBoolean(null, 'key')).toBeNull();
  });

  it('returns null for undefined object', () => {
    expect(getBoolean(undefined, 'key')).toBeNull();
  });
});

describe('getArray', () => {
  it('returns array for valid key', () => {
    expect(getArray({ items: [1, 2, 3] }, 'items')).toEqual([1, 2, 3]);
  });

  it('returns empty array for non-array value', () => {
    expect(getArray({ items: 'not-array' }, 'items')).toEqual([]);
  });

  it('returns empty array for null object', () => {
    expect(getArray(null, 'key')).toEqual([]);
  });

  it('returns empty array for undefined object', () => {
    expect(getArray(undefined, 'key')).toEqual([]);
  });

  it('returns empty array for missing key', () => {
    expect(getArray({ a: 1 }, 'missing')).toEqual([]);
  });
});

describe('getObject', () => {
  it('returns object for valid key', () => {
    const nested = { a: 1 };
    expect(getObject({ data: nested }, 'data')).toEqual(nested);
  });

  it('returns null for array value', () => {
    expect(getObject({ data: [1, 2] }, 'data')).toBeNull();
  });

  it('returns null for non-object value', () => {
    expect(getObject({ data: 'string' }, 'data')).toBeNull();
  });

  it('returns null for null object', () => {
    expect(getObject(null, 'key')).toBeNull();
  });

  it('returns null for undefined object', () => {
    expect(getObject(undefined, 'key')).toBeNull();
  });
});

describe('getNestedString', () => {
  it('returns nested string value', () => {
    const obj = { a: { b: { c: 'deep' } } };
    expect(getNestedString(obj as Record<string, unknown>, 'a', 'b', 'c')).toBe('deep');
  });

  it('returns null for missing path', () => {
    const obj = { a: { b: 1 } };
    expect(getNestedString(obj as Record<string, unknown>, 'a', 'x')).toBeNull();
  });

  it('returns null for null object', () => {
    expect(getNestedString(null, 'a')).toBeNull();
  });

  it('returns null if intermediate value is not an object', () => {
    const obj = { a: 'string' };
    expect(getNestedString(obj as Record<string, unknown>, 'a', 'b')).toBeNull();
  });
});

describe('getNestedNumber', () => {
  it('returns nested number value', () => {
    const obj = { a: { b: 42 } };
    expect(getNestedNumber(obj as Record<string, unknown>, 'a', 'b')).toBe(42);
  });

  it('returns null for non-number at path end', () => {
    const obj = { a: { b: 'not a number' } };
    expect(getNestedNumber(obj as Record<string, unknown>, 'a', 'b')).toBeNull();
  });

  it('returns null for null object', () => {
    expect(getNestedNumber(null, 'a')).toBeNull();
  });
});

describe('getNestedBoolean', () => {
  it('returns nested boolean value', () => {
    const obj = { a: { b: true } };
    expect(getNestedBoolean(obj as Record<string, unknown>, 'a', 'b')).toBe(true);
  });

  it('returns null for non-boolean at path end', () => {
    const obj = { a: { b: 'true' } };
    expect(getNestedBoolean(obj as Record<string, unknown>, 'a', 'b')).toBeNull();
  });

  it('returns null for null object', () => {
    expect(getNestedBoolean(null, 'a')).toBeNull();
  });
});

describe('formatBytes', () => {
  it('returns "-" for null', () => {
    expect(formatBytes(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatBytes(undefined)).toBe('-');
  });

  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB');
  });

  it('formats fractional values', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('formatGiB', () => {
  it('returns "-" for null', () => {
    expect(formatGiB(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatGiB(undefined)).toBe('-');
  });

  it('formats GiB value', () => {
    expect(formatGiB(100)).toBe('100 GiB');
  });

  it('formats zero', () => {
    expect(formatGiB(0)).toBe('0 GiB');
  });
});

describe('formatMiB', () => {
  it('returns "-" for null', () => {
    expect(formatMiB(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatMiB(undefined)).toBe('-');
  });

  it('formats MiB value', () => {
    expect(formatMiB(512)).toBe('512 MiB');
  });
});

describe('formatSeconds', () => {
  it('returns "-" for null', () => {
    expect(formatSeconds(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatSeconds(undefined)).toBe('-');
  });

  it('formats seconds under a minute', () => {
    expect(formatSeconds(45)).toBe('45s');
  });

  it('formats zero seconds', () => {
    expect(formatSeconds(0)).toBe('0s');
  });

  it('formats exact minutes', () => {
    expect(formatSeconds(120)).toBe('2m');
  });

  it('formats minutes and seconds', () => {
    expect(formatSeconds(90)).toBe('1m 30s');
  });

  it('formats large values', () => {
    expect(formatSeconds(3661)).toBe('61m 1s');
  });
});
