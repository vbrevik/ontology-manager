import { useState, useCallback } from 'react'

function readFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => readFromStorage(key, defaultValue))

  const setValue = useCallback(
    (value: T) => {
      setState(value)
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Silently ignore storage errors (quota, private browsing)
      }
    },
    [key],
  )

  return [state, setValue]
}
