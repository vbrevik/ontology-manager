import type { Class } from '@/features/ontology/lib/api'
import { SourceBadge } from '../shared/SourceBadge'
import { ClassLink } from '../shared/ClassLink'
import { EditableText } from '../shared/EditableText'

interface ClassHeaderProps {
  classData: Class
  parentClassName?: string
  onDescriptionSave?: (description: string) => void
  onNavigate?: (classId: string) => void
  onSourceClick?: (sourceId: string) => void
  isDescriptionSaving?: boolean
}

export function ClassHeader({
  classData,
  parentClassName,
  onDescriptionSave,
  onNavigate,
  onSourceClick,
  isDescriptionSaving,
}: ClassHeaderProps) {
  const sourceId = 'source_id' in classData
    ? (classData as Class & { source_id?: string }).source_id
    : undefined

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">{classData.name}</h2>
        {sourceId && <SourceBadge sourceId={sourceId} onSourceClick={onSourceClick} />}
      </div>

      {classData.parent_class_id && parentClassName && (
        <div className="text-sm text-muted-foreground">
          Parent:{' '}
          <ClassLink classId={classData.parent_class_id} label={parentClassName} onNavigate={onNavigate} />
        </div>
      )}

      <EditableText
        value={classData.description ?? ''}
        onSave={(newDesc) => onDescriptionSave?.(newDesc)}
        multiline
        maxLength={2000}
        loading={isDescriptionSaving}
        placeholder="Add a description..."
        className="text-muted-foreground"
      />
    </div>
  )
}
