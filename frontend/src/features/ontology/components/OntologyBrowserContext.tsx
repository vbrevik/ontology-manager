import { createContext, useContext } from 'react'

export interface OntologyBrowserContextValue {
  selectedClassId: string | null
  setSelectedClassId: (id: string | null) => void
  labelMode: 'name' | 'description'
  toggleLabelMode: () => void
}

export const OntologyBrowserContext =
  createContext<OntologyBrowserContextValue | null>(null)

export function useOntologyBrowser(): OntologyBrowserContextValue {
  const ctx = useContext(OntologyBrowserContext)
  if (!ctx)
    throw new Error(
      'useOntologyBrowser must be used within OntologyBrowserProvider',
    )
  return ctx
}
