import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any value by delay milliseconds
 * Ideal for search input fields, auto-save triggers, and filter bars
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Custom hook providing a debounced callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delayMs = 300
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<any>(null);

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const newTimeout = setTimeout(() => {
      callback(...args);
    }, delayMs);
    setTimeoutId(newTimeout);
  };
}
