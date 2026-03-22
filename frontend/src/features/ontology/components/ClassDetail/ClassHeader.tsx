import { useState } from 'react'
import type { Class } from '@/features/ontology/lib/api'
import { SourceBadge } from '../shared/SourceBadge'
import { ClassLink } from '../shared/ClassLink'

interface ClassHeaderProps {
  classData: Class
  parentClassName?: string
  onDescriptionSave?: (description: string) => void
  onNavigate?: (classId: string) => void
  onSourceClick?: (sourceId: string) => void
}

export function ClassHeader({
  classData,
  parentClassName,
  onDescriptionSave,
  onNavigate,
  onSourceClick,
}: ClassHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const sourceId = 'source_id' in classData
    ? (classData as Class & { source_id?: string }).source_id
    : undefined

  const handleDescriptionClick = () => {
    if (!classData.description) return
    setEditValue(classData.description)
    setIsEditing(true)
  }

  const handleSave = () => {
    setIsEditing(false)
    if (editValue !== classData.description) {
      onDescriptionSave?.(editValue)
    }
  }

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

      {classData.description && !isEditing && (
        <p
          className="cursor-pointer text-sm text-muted-foreground hover:bg-muted/50 rounded px-1 -mx-1"
          onClick={handleDescriptionClick}
        >
          {classData.description}
        </p>
      )}

      {isEditing && (
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSave()
            }
            if (e.key === 'Escape') {
              setIsEditing(false)
            }
          }}
          autoFocus
        />
      )}
    </div>
  )
}
