import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SourceBadge } from '../shared/SourceBadge'
import { ConflictBadge } from '../shared/ConflictBadge'

export interface ClassNodeData {
  id: string
  name: string
  description?: string
  source_id?: string
  parent_class_id?: string
  hasConflict?: boolean
}

interface ClassTreeNodeProps {
  data: ClassNodeData
  level: number
  isExpanded: boolean
  isSelected: boolean
  hasChildren: boolean
  labelMode: 'name' | 'description'
  onClick: () => void
  onToggle: () => void
}

export function ClassTreeNode({
  data,
  level,
  isExpanded,
  isSelected,
  hasChildren,
  labelMode,
  onClick,
  onToggle,
}: ClassTreeNodeProps) {
  const displayText =
    labelMode === 'description' && data.description
      ? data.description
      : data.name

  return (
    <div
      className={cn(
        'flex h-8 cursor-pointer items-center gap-1 rounded-sm px-1 text-sm',
        'hover:bg-muted',
        isSelected && 'bg-accent',
      )}
      style={{ paddingLeft: `${level * 20}px` }}
      onClick={onClick}
    >
      {hasChildren ? (
        <button
          data-testid="tree-chevron"
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center transition-transform duration-200',
            isExpanded && 'rotate-90',
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}

      <span className="min-w-0 truncate">{displayText}</span>

      {data.source_id && <SourceBadge sourceId={data.source_id} />}
      {data.hasConflict && <ConflictBadge />}
    </div>
  )
}
