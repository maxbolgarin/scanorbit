import { useState, useEffect, useCallback } from "react";

/**
 * Hook that syncs state with localStorage.
 * Values persist across page refreshes and browser sessions.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Prefix with app name to avoid conflicts
  const storageKey = `scanorbit:${key}`;

  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when value changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const valueToStore = value instanceof Function ? value(prev) : value;
          window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
          return valueToStore;
        });
      } catch (error) {
        console.warn(`Error setting localStorage key "${storageKey}":`, error);
      }
    },
    [storageKey]
  );

  return [storedValue, setValue];
}

/**
 * Hook for persisting table sorting preferences.
 */
export function usePersistedSort(
  pageKey: string,
  defaultSortKey: string = "",
  defaultSortDirection: "asc" | "desc" = "desc"
) {
  const [sortConfig, setSortConfig] = useLocalStorage<{
    key: string;
    direction: "asc" | "desc";
  }>(`${pageKey}:sort`, {
    key: defaultSortKey,
    direction: defaultSortDirection,
  });

  const handleSort = useCallback(
    (key: string) => {
      setSortConfig((prev) => ({
        key,
        direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
      }));
    },
    [setSortConfig]
  );

  return { sortConfig, handleSort, setSortConfig };
}
