import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import {
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  Filter,
  Download,
  Users,
  Database,
  Lock,
  Share2,
  Eye,
  XCircle,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export const Route = createFileRoute('/admin/access/explorer')({
  component: ExplorerPage,
})

type GraphNode = {
  id: string
  type: 'user' | 'resource' | 'role' | 'permission'
  label: string
  metadata?: Record<string, any>
}

type GraphEdge = {
  from: string
  to: string
  label: string
  type: 'owns' | 'has_role' | 'grants' | 'inherits'
}

const MOCK_NODES: GraphNode[] = [
  { id: 'user_1', type: 'user', label: 'Alice (Admin)', metadata: { email: 'alice@example.com' } },
  { id: 'user_2', type: 'user', label: 'Bob (Editor)', metadata: { email: 'bob@example.com' } },
  { id: 'user_3', type: 'user', label: 'Charlie (Viewer)', metadata: { email: 'charlie@example.com' } },
  { id: 'role_admin', type: 'role', label: 'Admin Role' },
  { id: 'role_editor', type: 'role', label: 'Editor Role' },
  { id: 'role_viewer', type: 'role', label: 'Viewer Role' },
  { id: 'perm_read', type: 'permission', label: 'Read Permission' },
  { id: 'perm_write', type: 'permission', label: 'Write Permission' },
  { id: 'perm_delete', type: 'permission', label: 'Delete Permission' },
  { id: 'doc_1', type: 'resource', label: 'Document Alpha', metadata: { owner: 'user_1' } },
  { id: 'doc_2', type: 'resource', label: 'Document Beta', metadata: { owner: 'user_2' } }
]

const MOCK_EDGES: GraphEdge[] = [
  { from: 'user_1', to: 'role_admin', label: 'has_role', type: 'has_role' },
  { from: 'user_2', to: 'role_editor', label: 'has_role', type: 'has_role' },
  { from: 'user_3', to: 'role_viewer', label: 'has_role', type: 'has_role' },
  { from: 'role_admin', to: 'perm_read', label: 'grants', type: 'grants' },
  { from: 'role_admin', to: 'perm_write', label: 'grants', type: 'grants' },
  { from: 'role_admin', to: 'perm_delete', label: 'grants', type: 'grants' },
  { from: 'role_editor', to: 'perm_read', label: 'grants', type: 'grants' },
  { from: 'role_editor', to: 'perm_write', label: 'grants', type: 'grants' },
  { from: 'role_viewer', to: 'perm_read', label: 'grants', type: 'grants' },
  { from: 'user_1', to: 'doc_1', label: 'owns', type: 'owns' },
  { from: 'user_2', to: 'doc_2', label: 'owns', type: 'owns' }
]

function ExplorerPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [zoom, setZoom] = useState(100)
  const [showLabels, setShowLabels] = useState(true)

  const filteredNodes = MOCK_NODES.filter(node => {
    const matchesSearch = node.label.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterType === 'all' || node.type === filterType
    return matchesSearch && matchesFilter
  })

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-500'
      case 'role': return 'bg-purple-500'
      case 'permission': return 'bg-green-500'
      case 'resource': return 'bg-orange-500'
      default: return 'bg-slate-500'
    }
  }

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'user': return Users
      case 'role': return Lock
      case 'permission': return Lock
      case 'resource': return Database
      default: return Network
    }
  }

  return (
    <div className="relative h-[800px] w-full rounded-[2.5rem] border border-border/40 bg-slate-950/20 shadow-2xl overflow-hidden backdrop-blur-sm group">
      {/* Immersive Graph Canvas */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5" />

      {/* The Graph Itself */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-500 will-change-transform"
        style={{ transform: `scale(${zoom / 100})` }}
      >
        <div className="grid grid-cols-4 gap-x-16 gap-y-12 p-20">
          {filteredNodes.map((node) => {
            const Icon = getNodeIcon(node.type)
            const isActive = selectedNode?.id === node.id
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={cn(
                  "relative flex flex-col items-center group/node transition-all duration-300",
                  isActive ? "scale-110" : "hover:scale-105"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-500",
                  getNodeColor(node.type),
                  isActive ? "ring-4 ring-white/30 shadow-primary/40 rotate-3" : "opacity-80 group-hover/node:opacity-100 group-hover/node:-translate-y-1"
                )}>
                  <Icon className="h-8 w-8" />
                </div>
                {showLabels && (
                  <div className={cn(
                    "mt-3 px-3 py-1 rounded-full text-[10px] font-bold tracking-tight uppercase transition-all duration-300 border backdrop-blur-md",
                    isActive
                      ? "bg-white text-slate-950 border-white"
                      : "bg-black/20 text-white/70 border-white/10 group-hover/node:bg-black/40 group-hover/node:text-white"
                  )}>
                    {node.label}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Floating Top Header */}
      <div className="absolute top-6 left-6 right-6 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto bg-background/40 backdrop-blur-xl border border-border/40 p-1 rounded-2xl shadow-2xl flex items-center gap-4">
          <div className="px-4 border-r border-border/20 py-2">
            <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
              <Network className="h-4 w-4 text-cyan-400" />
              Explorer
            </h3>
          </div>
          <div className="relative w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within:text-cyan-400" />
            <Input
              placeholder="Filter nodes..."
              className="bg-transparent border-none focus-visible:ring-0 h-9 text-xs pl-9 shadow-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-10 border-border/40 bg-background/40 backdrop-blur-md">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-1.5 rounded-[1.5rem] shadow-2xl flex items-center gap-2 ring-1 ring-white/5">
        <div className="flex items-center bg-black/20 rounded-xl px-2 h-10">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white" onClick={() => setZoom(Math.max(50, zoom - 10))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-[10px] font-mono font-bold w-12 text-center text-white/80">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white" onClick={() => setZoom(Math.min(200, zoom + 10))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-white/10" />

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-10 w-36 rounded-xl bg-black/20 border-none text-white text-xs font-semibold focus:ring-0">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 opacity-60" />
              <span>{filterType === 'all' ? 'All Types' : filterType.charAt(0).toUpperCase() + filterType.slice(1)}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="role">Roles</SelectItem>
            <SelectItem value="permission">Permissions</SelectItem>
            <SelectItem value="resource">Resources</SelectItem>
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-white/10" />

        <Button
          variant="ghost"
          size="icon"
          className={cn("h-10 w-10 rounded-xl transition-colors", showLabels ? "text-cyan-400 bg-cyan-400/10" : "text-white/40")}
          onClick={() => setShowLabels(!showLabels)}
        >
          <Eye className="h-5 w-5" />
        </Button>
      </div>

      {/* Floating Inspector Panel */}
      <div className={cn(
        "absolute top-6 right-6 bottom-6 w-80 bg-background/60 backdrop-blur-3xl border border-border/40 rounded-[2rem] shadow-2xl transition-all duration-500 overflow-hidden z-20",
        selectedNode ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"
      )}>
        {selectedNode ? (
          <div className="h-full flex flex-col">
            <div className="p-8 border-b border-border/20">
              <div className="flex items-center justify-between mb-6">
                <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 border-none", getNodeColor(selectedNode.type) + "/20 text-" + getNodeColor(selectedNode.type).split('-')[1] + "-400")}>
                  {selectedNode.type}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/5" onClick={() => setSelectedNode(null)}>
                  <XCircle className="h-5 w-5 opacity-40 hover:opacity-100" />
                </Button>
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-1">{selectedNode.label}</h2>
              <p className="text-xs font-mono text-muted-foreground opacity-60">{selectedNode.id}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Metadata</h4>
                <div className="space-y-3">
                  {selectedNode.metadata && Object.entries(selectedNode.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center group/prop">
                      <span className="text-xs text-muted-foreground capitalize">{key}</span>
                      <span className="text-xs font-semibold bg-muted px-2 py-1 rounded-lg group-hover/prop:bg-primary/10 group-hover/prop:text-primary transition-colors">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <span className="text-xs font-semibold bg-muted px-2 py-1 rounded-lg">
                      {selectedNode.type}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Connections</h4>
                <div className="space-y-2">
                  {MOCK_EDGES.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).map((edge, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/20 hover:border-primary/20 transition-colors cursor-default">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center border border-border/40 shadow-sm">
                          <Share2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-xs font-semibold">{edge.label}</span>
                      </div>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 bg-muted/20 border-t border-border/20">
              <Button className="w-full rounded-2xl h-12 font-bold shadow-lg shadow-primary/20 group">
                Edit Entity
                <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
