interface SourceBadgeProps {
  sourceId: string
}

export function SourceBadge({ sourceId }: SourceBadgeProps) {
  return (
    <span className="ml-auto shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {sourceId}
    </span>
  )
}
