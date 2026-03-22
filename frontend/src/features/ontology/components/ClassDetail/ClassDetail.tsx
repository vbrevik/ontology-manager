import { useOntologyBrowser } from '../OntologyBrowserContext'
import { useClassTree } from '../ClassTree/useClassTree'
import { useClassDetail } from './useClassDetail'
import { ClassHeader } from './ClassHeader'
import { ClassProperties } from './ClassProperties'
import { ClassConflicts } from './ClassConflicts'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Network, GitFork } from 'lucide-react'

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

function GraphPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Network className="h-12 w-12" />
      <h3 className="text-lg font-medium">Graph Visualization</h3>
      <p className="text-sm">Visual graph view coming soon</p>
    </div>
  )
}

function RelationshipsPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <GitFork className="h-12 w-12" />
      <h3 className="text-lg font-medium">Relationship Explorer</h3>
      <p className="text-sm">Explore class relationships coming soon</p>
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
    isDescriptionSaving,
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

  const conflictData = 'conflictData' in classData
    ? (classData as any).conflictData
    : undefined

  return (
    <div className="flex h-full flex-col" data-testid="class-detail">
      <Tabs defaultValue="detail" key={selectedClassId} className="flex h-full flex-col">
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="detail">Detail</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <ClassHeader
              classData={classData}
              parentClassName={parentClass?.name}
              onDescriptionSave={updateDescription}
              onNavigate={setSelectedClassId}
              isDescriptionSaving={isDescriptionSaving}
            />

            <ClassProperties
              properties={properties ?? []}
              versionId={currentVersion?.id ?? ''}
              onAddProperty={(input) => createProperty(input)}
              onDeleteProperty={deleteProperty}
            />

            <ClassConflicts conflictData={conflictData} />
          </div>
        </TabsContent>

        <TabsContent value="graph" className="flex-1 overflow-y-auto p-4">
          <GraphPlaceholder />
        </TabsContent>

        <TabsContent value="relationships" className="flex-1 overflow-y-auto p-4">
          <RelationshipsPlaceholder />
        </TabsContent>
      </Tabs>
    </div>
  )
}
