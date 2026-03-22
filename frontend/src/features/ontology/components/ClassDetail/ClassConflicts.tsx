import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface ConflictData {
  baseDefinition: Record<string, any>
  extensionDefinition: Record<string, any>
  resolutionStatus: 'unresolved' | 'base_wins' | 'extension_wins'
}

interface ClassConflictsProps {
  conflictData?: ConflictData | null
}

const statusLabels: Record<ConflictData['resolutionStatus'], string> = {
  unresolved: 'Unresolved',
  base_wins: 'Base wins',
  extension_wins: 'Extension wins',
}

export function ClassConflicts({ conflictData }: ClassConflictsProps) {
  if (!conflictData) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold">Conflicts</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Base Definition
          </h4>
          <pre className="rounded-md bg-muted p-2 text-xs">
            {JSON.stringify(conflictData.baseDefinition, null, 2)}
          </pre>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Extension Definition
          </h4>
          <pre className="rounded-md bg-muted p-2 text-xs">
            {JSON.stringify(conflictData.extensionDefinition, null, 2)}
          </pre>
        </div>
      </div>

      <Badge variant="outline">
        {statusLabels[conflictData.resolutionStatus]}
      </Badge>
    </div>
  )
}
