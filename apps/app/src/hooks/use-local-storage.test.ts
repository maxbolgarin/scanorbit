import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage, usePersistedSort } from './use-local-storage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns the initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('reads existing value from localStorage', () => {
    window.localStorage.setItem('scanorbit:test-key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('stored');
  });

  it('stores value in localStorage when set', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    act(() => {
      result.current[1]('new-value');
    });
    expect(result.current[0]).toBe('new-value');
    expect(window.localStorage.getItem('scanorbit:test-key')).toBe(JSON.stringify('new-value'));
  });

  it('supports updater function', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    expect(result.current[0]).toBe(1);
  });

  it('prefixes key with scanorbit:', () => {
    const { result } = renderHook(() => useLocalStorage('my-key', 'val'));
    act(() => {
      result.current[1]('updated');
    });
    expect(window.localStorage.getItem('scanorbit:my-key')).toBe(JSON.stringify('updated'));
    expect(window.localStorage.getItem('my-key')).toBeNull();
  });

  it('handles objects', () => {
    const { result } = renderHook(() =>
      useLocalStorage('obj-key', { a: 1, b: 'hello' })
    );
    act(() => {
      result.current[1]({ a: 2, b: 'world' });
    });
    expect(result.current[0]).toEqual({ a: 2, b: 'world' });
  });

  it('falls back to initial value on invalid JSON in localStorage', () => {
    window.localStorage.setItem('scanorbit:bad-key', 'not-json{{{');
    const { result } = renderHook(() => useLocalStorage('bad-key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });
});

describe('usePersistedSort', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns default sort config', () => {
    const { result } = renderHook(() => usePersistedSort('page'));
    expect(result.current.sortConfig).toEqual({ key: '', direction: 'desc' });
  });

  it('uses custom default values', () => {
    const { result } = renderHook(() => usePersistedSort('page', 'name', 'asc'));
    expect(result.current.sortConfig).toEqual({ key: 'name', direction: 'asc' });
  });

  it('toggles direction when sorting by the same key', () => {
    const { result } = renderHook(() => usePersistedSort('page', 'name', 'asc'));

    // Same key toggles asc -> desc
    act(() => {
      result.current.handleSort('name');
    });
    expect(result.current.sortConfig).toEqual({ key: 'name', direction: 'desc' });
  });

  it('resets to asc when sorting by a different key', () => {
    const { result } = renderHook(() => usePersistedSort('page', 'name', 'desc'));

    act(() => {
      result.current.handleSort('date');
    });
    expect(result.current.sortConfig).toEqual({ key: 'date', direction: 'asc' });
  });

  it('persists sort config in localStorage', () => {
    const { result } = renderHook(() => usePersistedSort('mypage', 'col', 'asc'));

    act(() => {
      result.current.handleSort('col');
    });

    const stored = window.localStorage.getItem('scanorbit:mypage:sort');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual({ key: 'col', direction: 'desc' });
  });
});
