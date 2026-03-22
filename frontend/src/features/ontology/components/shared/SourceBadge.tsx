import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SourceBadgeProps {
  sourceId: string | null | undefined
  sourceName?: string
  onSourceClick?: (sourceId: string) => void
}

function hashStringToHue(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return Math.abs(hash) % 360
}

export function SourceBadge({ sourceId, sourceName, onSourceClick }: SourceBadgeProps) {
  if (!sourceId) return null

  const hue = hashStringToHue(sourceId)
  const backgroundColor = `hsl(${hue}, 65%, 45%)`
  const label = (sourceName ?? sourceId).slice(0, 4).toUpperCase()

  return (
    <Badge
      variant="secondary"
      className={cn('text-xs', onSourceClick && 'cursor-pointer')}
      style={{ backgroundColor, color: 'white' }}
      onClick={onSourceClick ? () => onSourceClick(sourceId) : undefined}
    >
      {label}
    </Badge>
  )
}
