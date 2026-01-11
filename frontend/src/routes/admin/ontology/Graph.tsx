
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
import { createFileRoute } from '@tanstack/react-router';
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
import { fetchClasses, fetchEntityDescendants, fetchRelationshipTypes, createRelationship, deleteRelationship, fetchEntityRelationships, type RelationshipType } from '@/features/ontology/lib/api';
import { useOntologyContext } from '@/features/context/context-provider';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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
        try {
            if (currentContext) {
                // ENTITY MODE
                const entities = await fetchEntityDescendants(currentContext.id);

                // Add the root context itself if not in descendants? 
                // descendants typically excludes self in some impls, but includes in "path" queries.
                // Let's assume descendants includes the tree. 
                // Using simple layout for now: layers based on depth

                const newNodes: Node[] = entities.map((e) => ({
                    id: e.id,
                    data: { label: e.display_name },
                    position: { x: Math.random() * 500, y: e.depth * 150 },
                    type: 'default',
                    style: {
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(2, 132, 199, 0.2)',
                        borderRadius: '12px',
                        padding: '12px',
                        width: 160,
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#0369a1',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                    },
                }));

                if (!newNodes.find(n => n.id === currentContext.id)) {
                    newNodes.unshift({
                        id: currentContext.id,
                        data: { label: currentContext.name },
                        position: { x: 250, y: 0 },
                        type: 'input',
                        style: {
                            background: 'white',
                            border: '2px solid #0284c7',
                            borderRadius: '12px',
                            padding: '12px',
                            width: 180,
                            textAlign: 'center',
                            fontWeight: '700',
                            color: '#0c4a6e',
                            boxShadow: '0 10px 15px -3px rgb(2 132 199 / 0.1)'
                        }
                    });
                }

                const newEdges: Edge[] = [];
                entities.forEach(e => {
                    if (e.parent_entity_id) {
                        newEdges.push({
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

                const relPromises = entities.map(e => fetchEntityRelationships(e.id));
                const allRelsResults = await Promise.all(relPromises);
                const seenRelIds = new Set<string>();

                allRelsResults.flat().forEach(r => {
                    if (!seenRelIds.has(r.id)) {
                        seenRelIds.add(r.id);
                        newEdges.push({
                            id: `rel-${r.id}`,
                            source: r.source_entity_id,
                            target: r.target_entity_id,
                            label: r.relationship_type_name,
                            type: 'default',
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' },
                            style: { stroke: '#f97316', strokeWidth: 2.5 },
                            labelStyle: { fill: '#f97316', fontSize: 11, fontWeight: '700' }
                        });
                    }
                });

                setNodes(newNodes);
                setEdges(newEdges);

            } else {
                // SCHEMA MODE (Classes)
                const classes = await fetchClasses();

                const newNodes: Node[] = classes.map((c, index) => ({
                    id: c.id,
                    data: { label: c.name },
                    position: { x: (index % 5) * 200, y: Math.floor(index / 5) * 100 + 50 },
                    type: 'default',
                    style: {
                        background: '#fff',
                        border: '1px solid #777',
                        borderRadius: '8px',
                        padding: '10px',
                        width: 150,
                        textAlign: 'center'
                    },
                }));

                const newEdges: Edge[] = [];
                classes.forEach(c => {
                    if (c.parent_class_id) {
                        newEdges.push({
                            id: `e-${c.parent_class_id}-${c.id}`,
                            source: c.parent_class_id,
                            target: c.id,
                            label: 'inherits',
                            type: 'smoothstep',
                            markerEnd: { type: MarkerType.ArrowClosed },
                            style: { stroke: '#f97316' }, // Orange stroke
                            labelStyle: { fill: '#f97316', fontSize: 10 }
                        });
                    }
                });

                setNodes(newNodes);
                setEdges(newEdges);
            }

        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load graph data"
            });
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
            <div className="absolute top-4 left-4 z-10 bg-background/90 p-3 rounded-lg border border-border/40 backdrop-blur-md shadow-sm">
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
                        ? "Visualizing entity composition"
                        : "Visualizing class inheritance"}
                </p>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                fitView
            >
                <Controls />
                <MiniMap
                    nodeStrokeColor={currentContext ? "#0284c7" : "#f97316"}
                    nodeColor="#fff"
                />
                <Background gap={12} size={1} />
            </ReactFlow>

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
