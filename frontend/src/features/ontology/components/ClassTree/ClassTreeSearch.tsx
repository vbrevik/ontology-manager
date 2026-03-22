import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ClassTreeSearchProps {
  searchText: string
  onSearchChange: (text: string) => void
  sourceFilter: string | null
  onSourceFilterChange: (sourceId: string | null) => void
  availableSources: string[]
}

export function ClassTreeSearch({
  searchText,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  availableSources,
}: ClassTreeSearchProps) {
  const [localSearch, setLocalSearch] = useState(searchText)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync external searchText changes
  useEffect(() => {
    setLocalSearch(searchText)
  }, [searchText])

  const handleSearchInput = (value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 300)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="flex items-center gap-2 border-b p-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search classes..."
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {availableSources.length > 0 && (
        <select
          aria-label="Filter by source"
          value={sourceFilter ?? ''}
          onChange={(e) =>
            onSourceFilterChange(e.target.value || null)
          }
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All Sources</option>
          {availableSources.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
