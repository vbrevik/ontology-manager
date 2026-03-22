import { AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ConflictBadgeProps {
  className?: string
}

export function ConflictBadge({ className }: ConflictBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span data-testid="conflict-badge" className={cn('inline-flex', className)}>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        This class has conflicting definitions from multiple sources.
      </TooltipContent>
    </Tooltip>
  )
}
