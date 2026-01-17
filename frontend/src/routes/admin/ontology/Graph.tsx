import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    MiniMap,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@/features/ontology/styles/graph-animations.css';
import { Layers, Network } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { createFileRoute } from '@tanstack/react-router'
import { fetchClasses, fetchRelationshipTypes, createRelationship, deleteRelationship, deleteEntity, fetchEntityRelationships, type RelationshipType, getEntity, fetchEntities } from '@/features/ontology/lib/api';
import { NodeEditSheet } from '@/features/ontology/components/NodeEditSheet';
import { NodeContextMenu } from '@/features/ontology/components/NodeContextMenu';
import { AnimatedEdge } from '@/features/ontology/components/CustomEdges';
import { useOntologyContext } from '@/features/context/context-provider';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getLayoutedElements } from '@/features/ontology/lib/graphUtils';
import { EntityNode, ClassNode, ContextNode } from '@/features/ontology/components/CustomNodes';

const nodeTypes = {
    entity: EntityNode,
    class: ClassNode,
    context: ContextNode
};

const edgeTypes = {
    animated: AnimatedEdge,
};

export const Route = createFileRoute('/admin/ontology/Graph')({
    component: OntologyGraphPage,
});

function OntologyGraphPage() {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);
    const { toast } = useToast();
    const { currentContext } = useOntologyContext();

    // Dialog State
    const [isRelDialogOpen, setIsRelDialogOpen] = useState(false);
    const [pendingConnection, setPendingConnection] = useState<any>(null);
    const [selectedRelType, setSelectedRelType] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Edit Node State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedNodeType, setSelectedNodeType] = useState<'entity' | 'class' | 'context' | null>(null);
    const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string, type: string } | null>(null);

    useEffect(() => {
        loadGraphData();
        loadRelTypes();
    }, [currentContext]); // Reload when context changes

    async function loadRelTypes() {
        try {
            const types = await fetchRelationshipTypes();
            setRelTypes(types);
        } catch (err) {
            console.error("Failed to load relationship types", err);
        }
    }

    async function loadGraphData() {
        setIsLoading(true);
        try {
            let rawNodes: Node[] = [];
            let rawEdges: Edge[] = [];

            if (currentContext) {
                // ENTITY MODE
                // 1. Fetch root entity to get tenant_id and details
                const rootEntity = await getEntity(currentContext.id);

                // 2. Fetch all entities in the tenant (or global if no tenant) to build the tree
                const query: any = {};
                if (rootEntity.tenant_id) query.tenant_id = rootEntity.tenant_id;
                const allEntities = await fetchEntities(query);

                // 3. Client-side tree traversal to find descendants
                const params = new URLSearchParams(window.location.search);
                const fullGraph = params.get('full') === 'true';

                let relevantEntities: any[] = [];

                if (fullGraph) {
                    relevantEntities = allEntities;
                } else {
                    // BFS to find descendants of currentContext
                    const contextId = currentContext.id;
                    const childMap = new Map<string, any[]>();
                    allEntities.forEach(e => {
                        if (e.parent_entity_id) {
                            if (!childMap.has(e.parent_entity_id)) childMap.set(e.parent_entity_id, []);
                            childMap.get(e.parent_entity_id)!.push(e);
                        }
                    });

                    const queue = [contextId];
                    const visited = new Set<string>([contextId]);

                    // Add root if found in list, otherwise use fetched root
                    const rootInList = allEntities.find(e => e.id === contextId);
                    relevantEntities.push(rootInList || rootEntity);

                    while (queue.length > 0) {
                        const pid = queue.shift()!;
                        const children = childMap.get(pid) || [];
                        children.forEach(c => {
                            if (!visited.has(c.id)) {
                                visited.add(c.id);
                                queue.push(c.id);
                                relevantEntities.push(c);
                            }
                        });
                    }
                }

                rawNodes = relevantEntities.map((e) => ({
                    id: e.id,
                    data: {
                        label: e.display_name,
                        details: e.attributes
                    },
                    position: { x: 0, y: 0 },
                    type: e.id === currentContext.id ? 'context' : 'entity',
                }));

                const visitedIds = new Set(relevantEntities.map(e => e.id));

                relevantEntities.forEach(e => {
                    if (e.parent_entity_id && visitedIds.has(e.parent_entity_id)) {
                        rawEdges.push({
                            id: `struct-${e.parent_entity_id}-${e.id}`,
                            source: e.parent_entity_id,
                            target: e.id,
                            label: 'composed_of',
                            type: 'smoothstep',
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#0284c7' },
                            style: { stroke: '#0284c7', strokeWidth: 1.5, opacity: 0.6 },
                            labelStyle: { fill: '#0284c7', fontSize: 10, fontWeight: '500' }
                        });
                    }
                });

                const relPromises = relevantEntities.map(e => fetchEntityRelationships(e.id));
                const allRelsResults = await Promise.all(relPromises);
                const seenRelIds = new Set<string>();

                allRelsResults.flat().forEach(r => {
                    if (!seenRelIds.has(r.id) && visitedIds.has(r.source_entity_id) && visitedIds.has(r.target_entity_id)) {
                        seenRelIds.add(r.id);
                        rawEdges.push({
                            id: `rel-${r.id}`,
                            source: r.source_entity_id,
                            target: r.target_entity_id,
                            label: r.relationship_type_name,
                            type: 'animated',
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' },
                            style: { stroke: '#f97316', strokeWidth: 2.5 },
                            labelStyle: { fill: '#f97316', fontSize: 11, fontWeight: '700' }
                        });
                    }
                });
            } else {
                // SCHEMA MODE (Classes)
                const classes = await fetchClasses();

                rawNodes = classes.map((c) => ({
                    id: c.id,
                    data: { label: c.name },
                    position: { x: 0, y: 0 },
                    type: 'class', // Use class node
                }));

                classes.forEach(c => {
                    if (c.parent_class_id) {
                        rawEdges.push({
                            id: `e-${c.parent_class_id}-${c.id}`,
                            source: c.parent_class_id,
                            target: c.id,
                            label: 'inherits',
                            type: 'smoothstep',
                            markerEnd: { type: MarkerType.ArrowClosed },
                            style: { stroke: '#f97316' },
                            labelStyle: { fill: '#f97316', fontSize: 10 }
                        });
                    }
                });
            }

            // Apply Dagre Layout
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                rawNodes,
                rawEdges
            );

            setNodes([...layoutedNodes]);
            setEdges([...layoutedEdges]);

        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load graph data"
            });
        } finally {
            setIsLoading(false);
        }
    }

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [],
    );
    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [],
    );
    const onConnect: OnConnect = useCallback(
        (connection) => {
            if (!currentContext) {
                toast({
                    title: "Not Supported",
                    description: "Scaling the schema graph via drag-and-drop is not yet implemented. Use the Relationships tab.",
                });
                return;
            }
            setPendingConnection(connection);
            setIsRelDialogOpen(true);
        },
        [currentContext, toast],
    );

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            // Only allow editing for certain node types if needed
            const type = node.type as 'entity' | 'class' | 'context';
            setSelectedNodeId(node.id);
            setSelectedNodeType(type);
            setIsEditSheetOpen(true);
        },
        []
    );

    const onNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: Node) => {
            event.preventDefault();
            setContextMenu({
                x: event.clientX,
                y: event.clientY,
                nodeId: node.id,
                type: node.type || 'entity'
            });
        },
        [],
    );

    const onPaneClick = useCallback(() => setContextMenu(null), []);

    const handleDeleteNode = async () => {
        if (!contextMenu) return;
        try {
            if (contextMenu.type === 'entity') {
                await deleteEntity(contextMenu.nodeId);
            }
            toast({ title: "Deleted", description: "Node deleted successfully" });
            loadGraphData();
            setContextMenu(null);
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete node" });
        }
    };

    const handleCreateRelationship = async () => {
        if (!pendingConnection || !selectedRelType) return;

        try {
            setIsSaving(true);
            await createRelationship({
                source_entity_id: pendingConnection.source,
                target_entity_id: pendingConnection.target,
                relationship_type: selectedRelType,
            });

            toast({
                title: "Success",
                description: "Relationship created successfully",
            });

            // Refresh graph
            loadGraphData();
            setIsRelDialogOpen(false);
            setPendingConnection(null);
            setSelectedRelType('');
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: err.message || "Failed to create relationship",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const onEdgeClick = useCallback(async (_event: React.MouseEvent, edge: Edge) => {
        if (!currentContext) return;

        if (edge.id.startsWith('struct-')) {
            toast({
                title: "Information",
                description: "Structural relationships (composed_of) must be managed by updating the entity's parent.",
            });
            return;
        }

        if (confirm(`Remove this relationship?`)) {
            try {
                const relId = edge.id.replace('rel-', '');
                await deleteRelationship(relId);
                toast({
                    title: "Success",
                    description: "Relationship removed",
                });
                loadGraphData();
            } catch (err: any) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: err.message || "Failed to remove relationship",
                });
            }
        }
    }, [currentContext, toast]);

    return (
        <div className="h-[calc(100vh-150px)] w-full border border-border/40 rounded-xl overflow-hidden bg-background/50 backdrop-blur-sm shadow-sm relative">
            <div className="absolute top-4 left-4 z-10 bg-background/90 p-3 rounded-lg border border-border/40 backdrop-blur-md shadow-sm pointer-events-none">
                <h3 className="text-sm font-bold flex items-center space-x-2">
                    {currentContext ? (
                        <Network className="h-4 w-4 text-blue-500" />
                    ) : (
                        <Layers className="h-4 w-4 text-orange-500" />
                    )}
                    <span>{currentContext ? `${currentContext.name} Map` : 'Ontology Schema'}</span>
                </h3>
                <p className="text-[10px] text-muted-foreground mt-1">
                    {currentContext
                        ? "Visualizing entity composition & relationships"
                        : "Visualizing class inheritance"}
                </p>
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-background/90 backdrop-blur-md border border-border/40 rounded-xl p-6 shadow-lg animate-slide-up">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-medium text-foreground/80">Loading graph...</span>
                        </div>
                    </div>
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                onNodeClick={onNodeClick}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
            >
                <Controls className="bg-background/80 backdrop-blur border border-border/40" />
                <MiniMap
                    nodeStrokeColor={currentContext ? "#0284c7" : "#f97316"}
                    nodeColor="#eee"
                    className="bg-background/80 backdrop-blur border border-border/40"
                />
                <Background gap={24} size={1} className="opacity-50" />
            </ReactFlow>

            {contextMenu && (
                <NodeContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    type={contextMenu.type}
                    onClose={() => setContextMenu(null)}
                    onDelete={handleDeleteNode}
                    onInspect={async () => {
                        console.log("Inspect", contextMenu.nodeId);
                        if (contextMenu.type === 'entity') {
                            try {
                                const details = await getEntity(contextMenu.nodeId);
                                toast({
                                    title: details.display_name,
                                    description: JSON.stringify(details.attributes, null, 2),
                                });
                            } catch (e) {
                                toast({ title: "Error", description: "Failed to load details" });
                            }
                        } else {
                            toast({ description: `Inspecting node ${contextMenu.nodeId}` });
                        }
                        setContextMenu(null);
                    }}
                />
            )}

            <NodeEditSheet
                nodeId={selectedNodeId}
                type={selectedNodeType}
                isOpen={isEditSheetOpen}
                onClose={() => setIsEditSheetOpen(false)}
                onSaveSuccess={() => {
                    loadGraphData();
                    toast({ description: "Graph refreshed" });
                }}
            />

            <Dialog open={isRelDialogOpen} onOpenChange={setIsRelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Relationship</DialogTitle>
                        <DialogDescription>
                            Define the type of connection between these entities.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Relationship Type</Label>
                            <Select value={selectedRelType} onValueChange={setSelectedRelType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {relTypes.map(t => (
                                        <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRelDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateRelationship}
                            disabled={!selectedRelType || isSaving}
                        >
                            {isSaving ? "Creating..." : "Create Relationship"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
