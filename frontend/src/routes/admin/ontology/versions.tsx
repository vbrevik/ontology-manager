import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GitBranch,
  GitCommit,
  Clock,
  RotateCcw,
  CheckCircle2,
  History,
  FileDiff,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/ontology/versions')({
  component: VersionsPage,
})

type SchemaVersion = {
  id: string
  version: string
  timestamp: string
  author: string
  changes: number
  status: 'active' | 'archived' | 'draft'
  description: string
}

const MOCK_VERSIONS: SchemaVersion[] = [
  {
    id: 'v3',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    author: 'Alice Admin',
    changes: 12,
    status: 'active',
    description: 'Added support for vector embeddings in document nodes'
  },
  {
    id: 'v2',
    version: '2.1.0',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    author: 'Bob Dev',
    changes: 4,
    status: 'archived',
    description: 'Fixed relationship constraints for user-role mapping'
  },
  {
    id: 'v1',
    version: '1.0.0',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    author: 'System',
    changes: 45,
    status: 'archived',
    description: 'Initial schema definition'
  }
]

function VersionsPage() {
  const [versions] = useState<SchemaVersion[]>(MOCK_VERSIONS)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schema Versions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track changes, rollback updates, and manage ontology schema history
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Export History
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Column */}
        <div className="lg:col-span-2 relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border/50" />

          <div className="space-y-6">
            {versions.map((version) => (
              <div key={version.id} className="relative pl-14 group">
                {/* Timeline Dot */}
                <div className={cn(
                  "absolute left-[20px] top-6 w-3 h-3 rounded-full border-2 z-10 bg-background transition-colors",
                  version.status === 'active' ? "border-indigo-500 bg-indigo-500" : "border-muted-foreground"
                )} />

                <Card className={cn(
                  "transition-all duration-200 border-border/40",
                  version.status === 'active'
                    ? "bg-indigo-500/[0.03] border-indigo-500/20 shadow-md shadow-indigo-500/5"
                    : "bg-background/40 hover:bg-muted/10"
                )}>
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-bold text-lg flex items-center">
                            v{version.version}
                          </h3>
                          {version.status === 'active' && (
                            <Badge className="bg-indigo-500 hover:bg-indigo-600">
                              Current
                            </Badge>
                          )}
                          {version.status === 'draft' && (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {version.description}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {version.status !== 'active' && (
                          <Button variant="ghost" size="sm" className="h-8">
                            <RotateCcw className="mr-2 h-3 w-3" /> Rollback
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8">
                          <FileDiff className="mr-2 h-3 w-3" /> View Diff
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center space-x-6 text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="mr-1.5 h-3.5 w-3.5" />
                        {new Date(version.timestamp).toLocaleString()}
                      </div>
                      <div className="flex items-center">
                        <GitCommit className="mr-1.5 h-3.5 w-3.5" />
                        {version.author}
                      </div>
                      <div className="flex items-center">
                        <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                        {version.changes} modifications
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Status Column */}
        <div className="space-y-6">
          <Card className="border-border/40 bg-background/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center">
                <History className="mr-2 h-4 w-4 text-indigo-500" />
                Version Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Versions</span>
                <span className="font-bold font-mono">14</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Avg. Time Between</span>
                <span className="font-bold font-mono">5.2 days</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Commits</span>
                <span className="font-bold font-mono">143</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-indigo-500/20 bg-indigo-500/[0.02]">
            <CardContent className="p-4">
              <h4 className="font-bold text-sm mb-2 text-indigo-600 dark:text-indigo-400">
                Current Schema Status
              </h4>
              <div className="space-y-2">
                <div className="flex items-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  <span>Validation Passing</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  <span>Sync Status: Up to date</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
