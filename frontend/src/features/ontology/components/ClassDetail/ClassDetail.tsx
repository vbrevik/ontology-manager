import { useOntologyBrowser } from '../OntologyBrowserContext'
import { useClassTree } from '../ClassTree/useClassTree'
import { useClassDetail } from './useClassDetail'
import { ClassHeader } from './ClassHeader'
import { ClassProperties } from './ClassProperties'
import { ClassConflicts } from './ClassConflicts'

function DetailSkeleton() {
  return (
    <div className="space-y-4 p-4" data-testid="detail-skeleton">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-16 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

export function ClassDetail() {
  const { selectedClassId, setSelectedClassId } = useOntologyBrowser()
  const { classList } = useClassTree()
  const {
    classData,
    properties,
    currentVersion,
    isLoading,
    isPlaceholderData,
    updateDescription,
    createProperty,
    deleteProperty,
  } = useClassDetail(selectedClassId)

  if (!selectedClassId) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 text-muted-foreground"
        data-testid="class-detail"
      >
        Select a class to view details
      </div>
    )
  }

  if (isLoading || isPlaceholderData || !classData) {
    return <DetailSkeleton />
  }

  const parentClass = classData.parent_class_id
    ? classList.find((c) => c.id === classData.parent_class_id)
    : undefined

  // Check for conflict data (graceful degradation)
  const conflictData = 'conflictData' in classData
    ? (classData as any).conflictData
    : undefined

  return (
    <div className="h-full overflow-y-auto p-4" data-testid="class-detail">
      <div className="space-y-6">
        <ClassHeader
          classData={classData}
          parentClassName={parentClass?.name}
          onDescriptionSave={updateDescription}
          onNavigate={setSelectedClassId}
        />

        <ClassProperties
          properties={properties ?? []}
          versionId={currentVersion?.id ?? ''}
          onAddProperty={(input) => createProperty(input)}
          onDeleteProperty={deleteProperty}
        />

        <ClassConflicts conflictData={conflictData} />
      </div>
    </div>
  )
}
