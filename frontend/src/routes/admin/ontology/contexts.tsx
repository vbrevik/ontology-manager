
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
    fetchClasses,
    fetchEntities,
    type Entity,
    type Class,
    approveEntity,
    rejectEntity,
    createEntity,
    updateEntity,
    deleteEntity,
    suggestContexts,
    fetchRelationshipTypes,
    type RelationshipType,
    createRelationship
} from "@/features/ontology/lib/api";
import { useAi } from "@/features/ai/lib/context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Check,
    X,
    Loader2,
    Workflow,
    Plus,
    Sparkles,
    Globe,
    Calendar,
    Share2,
    Target,
    Clock,
    ArrowRight,
    Pencil,
    Trash2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input }
    from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute('/admin/ontology/contexts')({
    component: ContextManagement,
})

export default function ContextManagement() {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [relTypes, setRelTypes] = useState<RelationshipType[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { isAvailable, status: aiStatus } = useAi();

    // AI Wizard State
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [aiScenario, setAiScenario] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

    // Relationship State
    const [isLinkOpen, setIsLinkOpen] = useState(false);
    const [sourceEntity, setSourceEntity] = useState<Entity | null>(null);
    const [targetEntityId, setTargetEntityId] = useState("");
    const [linkLoading, setLinkLoading] = useState(false);

    // Manual Creation State
    const [isManualOpen, setIsManualOpen] = useState(false);
    const [manualForm, setManualForm] = useState({
        display_name: "",
        class_name: "Context",
        description: "",
        start_time: "",
        end_time: "",
        spatial_scope: "",
        confidence: 0.8
    });

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingContext, setEditingContext] = useState<Entity | null>(null);
    const [editForm, setEditForm] = useState({
        display_name: "",
        description: "",
        start_time: "",
        end_time: "",
        spatial_scope: "",
        confidence: 0.8
    });

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deletingContext, setDeletingContext] = useState<Entity | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            // Fetch all entities and filter for contexts on client-side for now
            // or we could use the class types.
            const [fetchedClasses, fetchedEntities, fetchedRels] = await Promise.all([
                fetchClasses(),
                fetchEntities(),
                fetchRelationshipTypes()
            ]);

            setClasses(fetchedClasses);
            setRelTypes(fetchedRels);

            // Filter entities that belong to Context or its subclasses
            const contextClassNames = ['Context', 'PoliticalContext', 'CrisisContext', 'OperationalContext', 'EnvironmentalContext'];
            const contexts = fetchedEntities.filter(e =>
                contextClassNames.includes(e.class_name)
            );

            setEntities(contexts);
        } catch (error) {
            console.error("Failed to load data:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load management data."
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleApprove = async (id: string) => {
        try {
            await approveEntity(id);
            toast({ title: "Approved", description: "Context approved successfully." });
            loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to approve context." });
        }
    };

    const handleReject = async (id: string) => {
        try {
            await rejectEntity(id);
            toast({ title: "Rejected", description: "Context rejected successfully." });
            loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to reject context." });
        }
    };

    const handleAiSuggest = async () => {
        if (!aiScenario.trim()) return;
        setAiLoading(true);
        try {
            const suggestions = await suggestContexts(aiScenario);
            setAiSuggestions(suggestions);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "AI failed to generate suggestions." });
        } finally {
            setAiLoading(false);
        }
    };

    const handleCreateSuggestion = async (suggestion: any) => {
        try {
            // Find class ID for the suggestion
            const cls = classes.find(c => c.name === suggestion.class_name || c.name === 'Context');
            if (!cls) throw new Error("Class not found");

            await createEntity({
                class_id: cls.id,
                display_name: suggestion.display_name,
                attributes: suggestion.attributes
            });

            toast({ title: "Created", description: `${suggestion.display_name} has been added.` });
            setAiSuggestions(prev => prev.filter(s => s !== suggestion));
            loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to create context." });
        }
    };

    const handleCreateLink = async () => {
        if (!sourceEntity || !targetEntityId) return;
        setLinkLoading(true);
        try {
            const type = relTypes.find(t => t.name === 'influences') || relTypes[0];
            await createRelationship({
                source_entity_id: sourceEntity.id,
                target_entity_id: targetEntityId,
                relationship_type: type.name
            });
            toast({ title: "Linked", description: "Contexts linked successfully." });
            setIsLinkOpen(false);
            setSourceEntity(null);
            setTargetEntityId("");
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to link contexts." });
        } finally {
            setLinkLoading(false);
        }
    };

    const handleManualCreate = async () => {
        try {
            const cls = classes.find(c => c.name === manualForm.class_name);
            if (!cls) throw new Error("Class not found");

            await createEntity({
                class_id: cls.id,
                display_name: manualForm.display_name,
                attributes: {
                    description: manualForm.description,
                    start_time: manualForm.start_time || null,
                    end_time: manualForm.end_time || null,
                    spatial_scope: manualForm.spatial_scope || null,
                    confidence: manualForm.confidence
                }
            });

            toast({ title: "Created", description: `${manualForm.display_name} has been added.` });
            setIsManualOpen(false);
            setManualForm({
                display_name: "",
                class_name: "Context",
                description: "",
                start_time: "",
                end_time: "",
                spatial_scope: "",
                confidence: 0.8
            });
            loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to create context." });
        }
    };

    const handleOpenEdit = (context: Entity) => {
        setEditingContext(context);
        setEditForm({
            display_name: context.display_name,
            description: context.attributes.description || "",
            start_time: context.attributes.start_time || "",
            end_time: context.attributes.end_time || "",
            spatial_scope: context.attributes.spatial_scope || "",
            confidence: context.attributes.confidence || 0.8
        });
        setIsEditOpen(true);
    };

    const handleUpdateContext = async () => {
        if (!editingContext) return;
        try {
            await updateEntity(editingContext.id, {
                display_name: editForm.display_name,
                attributes: {
                    description: editForm.description,
                    start_time: editForm.start_time || null,
                    end_time: editForm.end_time || null,
                    spatial_scope: editForm.spatial_scope || null,
                    confidence: editForm.confidence
                }
            });
            toast({ title: "Updated", description: `${editForm.display_name} has been updated.` });
            setIsEditOpen(false);
            setEditingContext(null);
            loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update context." });
        }
    };

    const handleOpenDelete = (context: Entity) => {
        setDeletingContext(context);
        setIsDeleteOpen(true);
    };

    const handleDeleteContext = async () => {
        if (!deletingContext) return;
        setDeleteLoading(true);
        try {
            await deleteEntity(deletingContext.id);
            toast({ title: "Deleted", description: `${deletingContext.display_name} has been removed.` });
            setIsDeleteOpen(false);
            setDeletingContext(null);
            loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete context." });
        } finally {
            setDeleteLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    const pendingCount = entities.filter(e => e.approval_status === "PENDING").length;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Workflow className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Context Management</h1>
                        <p className="text-muted-foreground">Orchestrate and link situational awareness data.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
                        <DialogTrigger asChild>
                            <Button
                                className={cn(
                                    "bg-gradient-to-r shadow-md",
                                    isAvailable
                                        ? "from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                                        : "from-gray-400 to-gray-500 cursor-not-allowed opacity-70"
                                )}
                                disabled={!isAvailable}
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                {isAvailable ? "AI Generator" : "AI Service Offline"}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-indigo-500" />
                                    AI Context Generator
                                </DialogTitle>
                                <DialogDescription>
                                    Describe a scenario to generate structured context entities using <strong>{aiStatus.model}</strong>.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Scenario Description</Label>
                                    <Input
                                        placeholder="e.g. Political instability in Eastern Europe affecting energy supplies in Germany..."
                                        value={aiScenario}
                                        onChange={e => setAiScenario(e.target.value)}
                                    />
                                </div>
                                <Button className="w-full" onClick={handleAiSuggest} disabled={aiLoading || !aiScenario.trim()}>
                                    {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                    Generate Suggestions
                                </Button>

                                {aiSuggestions.length > 0 && (
                                    <div className="space-y-3 mt-4 border-t pt-4 max-h-[300px] overflow-y-auto pr-2">
                                        {aiSuggestions.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 group hover:border-primary/30 transition-colors">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">{s.display_name}</span>
                                                        <Badge variant="outline" className="text-[10px]">{s.class_name}</Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>
                                                </div>
                                                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCreateSuggestion(s)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-orange-500/20 text-orange-600 hover:bg-orange-50">
                                <Plus className="h-4 w-4 mr-2" />
                                Manual New
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Create New Context</DialogTitle>
                                <DialogDescription>Manually define a situational awareness context.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Name</Label>
                                    <Input className="col-span-3" value={manualForm.display_name} onChange={e => setManualForm({ ...manualForm, display_name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Description</Label>
                                    <Input className="col-span-3" value={manualForm.description} onChange={e => setManualForm({ ...manualForm, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Type</Label>
                                    <select className="col-span-3 p-2 rounded-md border bg-background" value={manualForm.class_name} onChange={e => setManualForm({ ...manualForm, class_name: e.target.value })}>
                                        {['Context', 'PoliticalContext', 'CrisisContext', 'OperationalContext', 'EnvironmentalContext'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Start Time</Label>
                                    <Input className="col-span-3" placeholder="ISO8601 or 'Now'" value={manualForm.start_time} onChange={e => setManualForm({ ...manualForm, start_time: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">End Time</Label>
                                    <Input className="col-span-3" placeholder="ISO8601 or 'Ongoing'" value={manualForm.end_time} onChange={e => setManualForm({ ...manualForm, end_time: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Spatial</Label>
                                    <Input className="col-span-3" placeholder="Region or Coordinates" value={manualForm.spatial_scope} onChange={e => setManualForm({ ...manualForm, spatial_scope: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Confidence</Label>
                                    <Input type="number" step="0.1" min="0" max="1" className="col-span-3" value={manualForm.confidence} onChange={e => setManualForm({ ...manualForm, confidence: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleManualCreate} disabled={!manualForm.display_name.trim()}>Create Context</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="active" className="px-6">Active Contexts</TabsTrigger>
                    <TabsTrigger value="pending" className="px-6 relative">
                        Pending
                        {pendingCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
                                {pendingCount}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {entities.filter(e => e.approval_status !== "PENDING").length === 0 ? (
                            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                <p className="text-muted-foreground font-medium">No active contexts found.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Generate or create a new context to begin.</p>
                            </div>
                        ) : (
                            entities.filter(e => e.approval_status !== "PENDING").map((context) => (
                                <ContextCard
                                    key={context.id}
                                    context={context}
                                    onLink={() => {
                                        setSourceEntity(context);
                                        setIsLinkOpen(true);
                                    }}
                                    onEdit={() => handleOpenEdit(context)}
                                    onDelete={() => handleOpenDelete(context)}
                                />
                            ))
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="pending" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {entities.filter(e => e.approval_status === "PENDING").length === 0 ? (
                            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-2xl bg-muted/20 text-muted-foreground">
                                No pending approval requests.
                            </div>
                        ) : (
                            entities.filter(e => e.approval_status === "PENDING").map((context) => (
                                <ContextCard
                                    key={context.id}
                                    context={context}
                                    pending
                                    onApprove={() => handleApprove(context.id)}
                                    onReject={() => handleReject(context.id)}
                                />
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Relationship Link Dialog */}
            <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Link Context Relationship</DialogTitle>
                        <DialogDescription>
                            Define how "{sourceEntity?.display_name}" influences or connects to another context.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-primary/10">
                            <Badge variant="outline" className="bg-primary/5">{sourceEntity?.class_name}</Badge>
                            <span className="font-semibold text-sm">{sourceEntity?.display_name}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                            <Target className="h-4 w-4 text-orange-500" />
                        </div>

                        <div className="space-y-2">
                            <Label>Target Context</Label>
                            <select
                                className="w-full p-2 rounded-md border bg-background"
                                value={targetEntityId}
                                onChange={e => setTargetEntityId(e.target.value)}
                            >
                                <option value="">Select a context...</option>
                                {entities.filter(e => e.id !== sourceEntity?.id).map(e => (
                                    <option key={e.id} value={e.id}>{e.display_name} ({e.class_name})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLinkOpen(false)}>Cancel</Button>
                        <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleCreateLink} disabled={linkLoading || !targetEntityId}>
                            {linkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
                            Create Influence Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Context Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-blue-500" />
                            Edit Context
                        </DialogTitle>
                        <DialogDescription>Update the context details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Name</Label>
                            <Input className="col-span-3" value={editForm.display_name} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Description</Label>
                            <Input className="col-span-3" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Start Time</Label>
                            <Input className="col-span-3" placeholder="ISO8601 or 'Now'" value={editForm.start_time} onChange={e => setEditForm({ ...editForm, start_time: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">End Time</Label>
                            <Input className="col-span-3" placeholder="ISO8601 or 'Ongoing'" value={editForm.end_time} onChange={e => setEditForm({ ...editForm, end_time: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Spatial</Label>
                            <Input className="col-span-3" placeholder="Region or Coordinates" value={editForm.spatial_scope} onChange={e => setEditForm({ ...editForm, spatial_scope: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Confidence</Label>
                            <Input type="number" step="0.1" min="0" max="1" className="col-span-3" value={editForm.confidence} onChange={e => setEditForm({ ...editForm, confidence: parseFloat(e.target.value) })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleUpdateContext} disabled={!editForm.display_name.trim()}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600">
                            <Trash2 className="h-5 w-5" />
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deletingContext?.display_name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteContext} disabled={deleteLoading}>
                            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ContextCard({ context, pending, onApprove, onReject, onLink, onEdit, onDelete }: {
    context: Entity,
    pending?: boolean,
    onApprove?: () => void,
    onReject?: () => void,
    onLink?: () => void,
    onEdit?: () => void,
    onDelete?: () => void
}) {
    const startTime = context.attributes.start_time;
    const endTime = context.attributes.end_time;
    const spatial = context.attributes.spatial_scope;
    const confidence = context.attributes.confidence;

    return (
        <Card className={cn(
            "group overflow-hidden border-border/40 hover:border-primary/30 transition-all hover:shadow-md",
            pending ? "border-amber-500/30 bg-amber-500/[0.02]" : "bg-card"
        )}>
            <div className="h-1.5 w-full bg-muted overflow-hidden">
                <div className={cn(
                    "h-full transition-all duration-1000",
                    context.class_name === 'CrisisContext' ? "bg-rose-500" :
                        context.class_name === 'PoliticalContext' ? "bg-indigo-500" :
                            context.class_name === 'OperationalContext' ? "bg-emerald-500" : "bg-orange-500"
                )} style={{ width: `${(confidence || 0.8) * 100}%` }} />
            </div>

            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider mb-2">
                        {context.class_name}
                    </Badge>
                    {confidence !== undefined && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {Math.round(confidence * 100)}%
                        </span>
                    )}
                </div>
                <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors">
                    {context.display_name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {context.attributes.description || "Experimental context entity generated from observational data."}
                </p>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground p-2 rounded-lg bg-muted/30">
                        <Calendar className="h-3 w-3 text-orange-500" />
                        <span className="truncate">{startTime || 'Immediate'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground p-2 rounded-lg bg-muted/30">
                        <Clock className="h-3 w-3 text-rose-500" />
                        <span className="truncate">{endTime || 'Ongoing'}</span>
                    </div>
                    {spatial && (
                        <div className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground p-2 rounded-lg bg-muted/30">
                            <Globe className="h-3 w-3 text-sky-500" />
                            <span className="truncate">{spatial}</span>
                        </div>
                    )}
                </div>

                {context.parent_entity_id && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-2">
                        <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                        <span>Part of: <strong>{context.parent_entity_name || 'Parent Context'}</strong></span>
                    </div>
                )}

                {!pending && (
                    <div className="flex items-center gap-2 pt-2">
                        <Button size="sm" variant="ghost" className="flex-1 text-xs h-8 hover:bg-primary/10 hover:text-primary" onClick={onLink}>
                            <Share2 className="h-3.5 w-3.5 mr-1.5" />
                            Link
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1 text-xs h-8 hover:bg-blue-500/10 hover:text-blue-600" onClick={onEdit}>
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1 text-xs h-8 hover:bg-rose-500/10 hover:text-rose-600" onClick={onDelete}>
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                        </Button>
                    </div>
                )}

                {pending && (
                    <div className="flex items-center gap-2 pt-2">
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs h-8" onClick={onApprove}>
                            <Check className="h-4 w-4 mr-1.5" />
                            Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 border-rose-500/20 text-rose-600 hover:bg-rose-50 text-xs h-8" onClick={onReject}>
                            <X className="h-4 w-4 mr-1.5" />
                            Reject
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
