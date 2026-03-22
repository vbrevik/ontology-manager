import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

export interface OntologyBrowserContextValue {
  selectedClassId: string | null
  setSelectedClassId: (id: string | null) => void
  labelMode: 'name' | 'description'
  toggleLabelMode: () => void
}

const OntologyBrowserContext =
  createContext<OntologyBrowserContextValue | null>(null)

const SELECTED_KEY = 'ontology-browser-selected'
const LABEL_MODE_KEY = 'ontology-browser-label-mode'

function readSelectedFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(SELECTED_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return null
  }
}

function readLabelModeFromStorage(): 'name' | 'description' {
  try {
    const raw = localStorage.getItem(LABEL_MODE_KEY)
    if (raw === 'description') return 'description'
    return 'name'
  } catch {
    return 'name'
  }
}

interface OntologyBrowserProviderProps {
  children: ReactNode
  classList?: Array<{ id: string }>
}

export function OntologyBrowserProvider({
  children,
  classList,
}: OntologyBrowserProviderProps) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    readSelectedFromStorage,
  )
  const [labelMode, setLabelMode] = useState<'name' | 'description'>(
    readLabelModeFromStorage,
  )

  // Persist selectedClassId to localStorage
  useEffect(() => {
    if (selectedClassId === null) {
      localStorage.removeItem(SELECTED_KEY)
    } else {
      localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedClassId))
    }
  }, [selectedClassId])

  // Persist labelMode to localStorage
  useEffect(() => {
    localStorage.setItem(LABEL_MODE_KEY, labelMode)
  }, [labelMode])

  // Stale selection recovery: clear selectedClassId if not in class list.
  // Use a ref for selectedClassId so the effect only runs when classList changes,
  // avoiding an O(n) scan on every selection change.
  const selectedClassIdRef = useRef(selectedClassId)
  selectedClassIdRef.current = selectedClassId

  useEffect(() => {
    const current = selectedClassIdRef.current
    if (
      current !== null &&
      classList &&
      classList.length > 0 &&
      !classList.some((cls) => cls.id === current)
    ) {
      setSelectedClassId(null)
    }
  }, [classList])

  const toggleLabelMode = useCallback(() => {
    setLabelMode((prev) => (prev === 'name' ? 'description' : 'name'))
  }, [])

  return (
    <OntologyBrowserContext.Provider
      value={{ selectedClassId, setSelectedClassId, labelMode, toggleLabelMode }}
    >
      {children}
    </OntologyBrowserContext.Provider>
  )
}

export function useOntologyBrowser(): OntologyBrowserContextValue {
  const ctx = useContext(OntologyBrowserContext)
  if (!ctx)
    throw new Error(
      'useOntologyBrowser must be used within OntologyBrowserProvider',
    )
  return ctx
}
