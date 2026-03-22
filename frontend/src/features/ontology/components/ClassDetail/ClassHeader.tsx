import type { Class } from '@/features/ontology/lib/api'
import { SourceBadge } from '../shared/SourceBadge'
import { ClassLink } from '../shared/ClassLink'

interface ClassHeaderProps {
  classData: Class
  parentClassName?: string
  onDescriptionSave?: (description: string) => void
}

export function ClassHeader({
  classData,
  parentClassName,
}: ClassHeaderProps) {
  const sourceId = 'source_id' in classData
    ? (classData as Class & { source_id?: string }).source_id
    : undefined

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">{classData.name}</h2>
        {sourceId && <SourceBadge sourceId={sourceId} />}
      </div>

      {classData.parent_class_id && parentClassName && (
        <div className="text-sm text-muted-foreground">
          Parent:{' '}
          <ClassLink classId={classData.parent_class_id}>
            {parentClassName}
          </ClassLink>
        </div>
      )}

      {classData.description && (
        <p className="text-sm text-muted-foreground">
          {classData.description}
        </p>
      )}
    </div>
  )
}
