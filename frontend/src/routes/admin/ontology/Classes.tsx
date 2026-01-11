import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Layers,
    Plus,
    ChevronRight,
    Settings2,
    Database,
    Binary,
    Search,
    Trash2,
    Info,
    Sparkles
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { fetchClasses, fetchCurrentVersion, createClass, updateClass, deleteClass, fetchProperties, createProperty, updateProperty, deleteProperty, type Class, type OntologyVersion, type Property } from '@/features/ontology/lib/api'
import { generateClassDescription } from '@/features/ontology/lib/ai'
import { Switch } from "@/components/ui/switch"

export const Route = createFileRoute('/admin/ontology/Classes')({
    component: ClassesPage,
})

function ClassesPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentVersion, setCurrentVersion] = useState<OntologyVersion | null>(null);
    const { toast } = useToast();

    // Create dialog state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newParentId, setNewParentId] = useState<string>('');
    const [newIsAbstract, setNewIsAbstract] = useState(false);
    const [generatingDesc, setGeneratingDesc] = useState(false);

    // Edit dialog state
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [classProperties, setClassProperties] = useState<Property[]>([]);

    // Property dialog state
    const [isPropDialogOpen, setIsPropDialogOpen] = useState(false);
    const [editingProperty, setEditingProperty] = useState<Property | null>(null);
    const [propName, setPropName] = useState('');
    const [propDesc, setPropDesc] = useState('');
    const [propType, setPropType] = useState('string');
    const [propRequired, setPropRequired] = useState(false);
    const [propUnique, setPropUnique] = useState(false);
    const [propRegex, setPropRegex] = useState('');
    const [propMin, setPropMin] = useState<string>('');
    const [propMax, setPropMax] = useState<string>('');
    const [propOptions, setPropOptions] = useState('');
    const [isPropSaving, setIsPropSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (editingClass) {
            loadProperties(editingClass.id);
        }
    }, [editingClass]);

    async function loadProperties(classId: string) {
        try {
            const props = await fetchProperties(classId);
            setClassProperties(props);
        } catch (err) {
            console.error(err);
        }
    }

    async function loadData() {
        try {
            const [classesData, versionData] = await Promise.all([
                fetchClasses(),
                fetchCurrentVersion()
            ]);
            setClasses(classesData);
            setCurrentVersion(versionData);
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load ontology data"
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateClass() {
        if (!currentVersion) return;
        try {
            await createClass({
                name: newName,
                description: newDesc,
                parent_class_id: newParentId === "none" ? undefined : (newParentId || undefined),
                version_id: currentVersion.id,
                is_abstract: newIsAbstract
            });
            toast({ title: "Success", description: `Class ${newName} created.` });
            setIsCreateOpen(false);
            setNewName('');
            setNewDesc('');
            setNewParentId('');
            setNewIsAbstract(false);
            loadData();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to create class" });
        }
    }

    async function handleUpdateClass() {
        if (!editingClass) return;
        try {
            await updateClass(editingClass.id, {
                description: editingClass.description,
                parent_class_id: editingClass.parent_class_id === "none" ? undefined : (editingClass.parent_class_id || undefined),
                is_abstract: editingClass.is_abstract
            });
            toast({ title: "Success", description: "Class updated successfully." });
            setEditingClass(null);
            loadData();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update class" });
        }
    }

    async function handleDeleteClass(id: string) {
        if (!confirm("Are you sure you want to delete this class? This will also delete all its properties and instances.")) return;
        try {
            await deleteClass(id);
            toast({ title: "Success", description: "Class deleted." });
            loadData();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete class" });
        }
    }

    async function handleSaveProperty() {
        if (!editingClass || !currentVersion) return;
        try {
            setIsPropSaving(true);
            const validation_rules: any = {};
            if (propRegex) validation_rules.regex = propRegex;
            if (propMin) validation_rules.min = parseFloat(propMin);
            if (propMax) validation_rules.max = parseFloat(propMax);
            if (propOptions) validation_rules.options = propOptions.split(',').map(o => o.trim());

            const input = {
                name: propName,
                description: propDesc,
                class_id: editingClass.id,
                data_type: propType,
                is_required: propRequired,
                is_unique: propUnique,
                version_id: currentVersion.id,
                validation_rules: Object.keys(validation_rules).length > 0 ? validation_rules : undefined
            };

            if (editingProperty) {
                await updateProperty(editingProperty.id, {
                    description: propDesc,
                    data_type: propType,
                    is_required: propRequired,
                    is_unique: propUnique,
                    validation_rules: Object.keys(validation_rules).length > 0 ? validation_rules : null
                });
                toast({ title: "Success", description: "Property updated." });
            } else {
                await createProperty(input);
                toast({ title: "Success", description: `Property ${propName} created.` });
            }

            setIsPropDialogOpen(false);
            resetPropForm();
            loadProperties(editingClass.id);
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save property" });
        } finally {
            setIsPropSaving(false);
        }
    }

    function resetPropForm() {
        setEditingProperty(null);
        setPropName('');
        setPropDesc('');
        setPropType('string');
        setPropRequired(false);
        setPropUnique(false);
        setPropRegex('');
        setPropMin('');
        setPropMax('');
        setPropOptions('');
    }

    function handleEditProperty(prop: Property) {
        setEditingProperty(prop);
        setPropName(prop.name);
        setPropDesc(prop.description || '');
        setPropType(prop.data_type);
        setPropRequired(prop.is_required);
        setPropUnique(prop.is_unique);

        const rules = prop.validation_rules as any || {};
        setPropRegex(rules.regex || '');
        setPropMin(rules.min?.toString() || '');
        setPropMax(rules.max?.toString() || '');
        setPropOptions(rules.options?.join(', ') || '');

        setIsPropDialogOpen(true);
    }

    async function handleDeleteProperty(id: string) {
        if (!confirm("Delete this property?")) return;
        try {
            await deleteProperty(id);
            if (editingClass) loadProperties(editingClass.id);
            toast({ title: "Success", description: "Property deleted." });
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete property" });
        }
    }

    const filteredClasses = classes.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Classes & Properties</h2>
                    <p className="text-muted-foreground text-sm">
                        Define the metadata schema and inheritance hierarchy for your graph entities.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter classes..."
                            className="pl-8 bg-background/50 border-border/40"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-500/10">
                                <Plus className="mr-2 h-4 w-4" /> New Class
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] bg-background border-border/40">
                            <DialogHeader>
                                <DialogTitle>Create Ontological Class</DialogTitle>
                                <DialogDescription>
                                    Define a new entity type for your graph. This will be added to the current version ({currentVersion?.version || 'unknown'}).
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Class Name</Label>
                                    <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. TacticalUnit" />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="desc">Description</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={async () => {
                                                if (!newName) {
                                                    toast({
                                                        variant: "destructive",
                                                        title: "Name Required",
                                                        description: "Please enter a class name first"
                                                    });
                                                    return;
                                                }
                                                setGeneratingDesc(true);
                                                try {
                                                    const desc = await generateClassDescription(newName);
                                                    setNewDesc(desc);
                                                    toast({
                                                        title: "Description Generated",
                                                        description: "AI has generated a description for your class"
                                                    });
                                                } catch (err) {
                                                    console.error(err);
                                                    toast({
                                                        variant: "destructive",
                                                        title: "Generation Failed",
                                                        description: "Failed to generate description"
                                                    });
                                                } finally {
                                                    setGeneratingDesc(false);
                                                }
                                            }}
                                            disabled={!newName || generatingDesc}
                                        >
                                            <Sparkles className="mr-1 h-3 w-3" />
                                            {generatingDesc ? 'Generating...' : 'Generate'}
                                        </Button>
                                    </div>
                                    <Input id="desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Human-readable description" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="parent">Parent Class (Inheritance)</Label>
                                    <Select value={newParentId} onValueChange={setNewParentId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select parent (optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None (Root Class)</SelectItem>
                                            {classes.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between space-x-2 py-2">
                                    <div className="space-y-0.5">
                                        <Label>Abstract Class</Label>
                                        <p className="text-[11px] text-muted-foreground">Abstract classes cannot have instances.</p>
                                    </div>
                                    <Switch checked={newIsAbstract} onCheckedChange={setNewIsAbstract} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateClass} disabled={!newName || !currentVersion} className="bg-orange-600 hover:bg-orange-700">
                                    Create Class
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredClasses.map((item) => (
                    <Card key={item.id} className="border-border/40 bg-background/40 hover:bg-background/60 hover:border-orange-500/20 transition-all duration-300 group">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                        <Layers className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-bold text-lg">{item.name}</h3>
                                            {item.parent_class_id && (
                                                <Badge variant="outline" className="text-[10px] h-4 font-normal flex items-center space-x-1 border-blue-500/20 text-blue-500">
                                                    <ChevronRight className="h-3 w-3" />
                                                    <span>Inherits from parent</span>
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-1">
                                            {item.description || "System-defined entity class"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-6 mr-4">
                                    <div className="flex flex-col items-center group-hover:scale-105 transition-transform">
                                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                            <Database className="h-3.5 w-3.5" />
                                            <span>Properties</span>
                                        </div>
                                        <span className="font-bold text-sm">{Object.keys(item.attributes || {}).length}</span>
                                    </div>
                                    <div className="h-8 w-px bg-border/40" />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-primary"
                                        onClick={() => setEditingClass(item)}
                                    >
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDeleteClass(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                {Object.entries(item.attributes || {}).map(([key, value]) => (
                                    <Badge key={key} variant="secondary" className="bg-muted/30 text-[10px] py-0 h-5 border border-border/40 flex items-center space-x-1">
                                        <Binary className="h-3 w-3 text-muted-foreground/50" />
                                        <span>{key}</span>
                                        <span className="text-muted-foreground/60">({typeof value})</span>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredClasses.length === 0 && !loading && (
                <div className="text-center py-20 border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
                    <Database className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-medium">No classes found</h3>
                    <p className="text-muted-foreground mt-2">
                        Try adjusting your search or create a new ontological class.
                    </p>
                </div>
            )}
            {/* Edit Dialog */}
            <Dialog open={!!editingClass} onOpenChange={(open: boolean) => !open && setEditingClass(null)}>
                <DialogContent className="sm:max-w-xl bg-background border-border/40">
                    <DialogHeader>
                        <DialogTitle>Edit Class: {editingClass?.name}</DialogTitle>
                        <DialogDescription>
                            Modify metadata and properties for this ontological class.
                        </DialogDescription>
                    </DialogHeader>
                    {editingClass && (
                        <div className="grid gap-6 py-4">
                            <div className="grid gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-desc">Description</Label>
                                    <Input
                                        id="edit-desc"
                                        value={editingClass.description || ''}
                                        onChange={e => setEditingClass({ ...editingClass, description: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-parent">Parent Class</Label>
                                    <Select
                                        value={editingClass.parent_class_id || "none"}
                                        onValueChange={(val: string) => setEditingClass({ ...editingClass, parent_class_id: val === "none" ? undefined : val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select parent" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None (Root Class)</SelectItem>
                                            {classes.filter(c => c.id !== editingClass.id).map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between space-x-2">
                                    <div className="space-y-0.5">
                                        <Label>Abstract Class</Label>
                                        <p className="text-[11px] text-muted-foreground">Abstract classes cannot have instances.</p>
                                    </div>
                                    <Switch
                                        checked={editingClass.is_abstract}
                                        onCheckedChange={val => setEditingClass({ ...editingClass, is_abstract: val })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold flex items-center space-x-2">
                                        <Binary className="h-4 w-4 text-orange-500" />
                                        <span>Properties & Attributes</span>
                                    </h4>
                                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsPropDialogOpen(true)}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Property
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {classProperties.map((prop) => (
                                        <div key={prop.id} className="flex items-center justify-between p-2 rounded-lg bg-background/40 border border-border/40">
                                            <div className="flex items-center space-x-3">
                                                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                                    <Info className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-medium flex items-center space-x-2">
                                                        <span>{prop.name}</span>
                                                        {prop.is_required && <Badge className="text-[8px] h-3 px-1">Required</Badge>}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center space-x-2">
                                                        <span>Type: {prop.data_type}</span>
                                                        {prop.validation_rules && (
                                                            <span className="text-orange-500 font-medium">Validated</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={() => handleEditProperty(prop)}
                                                >
                                                    <Settings2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeleteProperty(prop.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {classProperties.length === 0 && (
                                        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg">
                                            No explicit properties defined.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingClass(null)}>Cancel</Button>
                        <Button onClick={handleUpdateClass} className="bg-orange-600 hover:bg-orange-700">
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Property Dialog */}
            <Dialog open={isPropDialogOpen} onOpenChange={setIsPropDialogOpen}>
                <DialogContent className="sm:max-w-md bg-background border-border/40">
                    <DialogHeader>
                        <DialogTitle>Add Property to {editingClass?.name}</DialogTitle>
                        <DialogDescription>
                            Define a new attribute with optional validation rules.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Property Name</Label>
                                <Input value={propName} onChange={e => setPropName(e.target.value)} placeholder="e.g. weight" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Data Type</Label>
                                <Select value={propType} onValueChange={setPropType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6 py-2">
                            <div className="flex items-center space-x-2">
                                <Switch checked={propRequired} onCheckedChange={setPropRequired} />
                                <Label className="text-xs">Required</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch checked={propUnique} onCheckedChange={setPropUnique} />
                                <Label className="text-xs">Unique</Label>
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-border/40 pt-4 mt-2">
                            <Label className="text-xs font-bold text-orange-500 flex items-center space-x-2">
                                <Settings2 className="h-3 w-3" />
                                <span>Validation Rules</span>
                            </Label>

                            {propType === 'string' && (
                                <div className="grid gap-2">
                                    <Label className="text-[10px]">Regex Pattern</Label>
                                    <Input
                                        value={propRegex}
                                        onChange={e => setPropRegex(e.target.value)}
                                        placeholder="e.g. ^[A-Z]{3}-\d+$"
                                        className="h-8 text-xs"
                                    />
                                </div>
                            )}

                            {propType === 'number' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label className="text-[10px]">Min Value</Label>
                                        <Input
                                            type="number"
                                            value={propMin}
                                            onChange={e => setPropMin(e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-[10px]">Max Value</Label>
                                        <Input
                                            type="number"
                                            value={propMax}
                                            onChange={e => setPropMax(e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label className="text-[10px]">Allowed Options (CSV)</Label>
                                <Input
                                    value={propOptions}
                                    onChange={e => setPropOptions(e.target.value)}
                                    placeholder="e.g. red, green, blue"
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setIsPropDialogOpen(false); resetPropForm(); }}>Cancel</Button>
                        <Button onClick={handleSaveProperty} disabled={!propName || isPropSaving} className="bg-orange-600 hover:bg-orange-700">
                            {isPropSaving ? "Saving..." : (editingProperty ? "Save Changes" : "Add Property")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
