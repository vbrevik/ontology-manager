import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Settings2,
    Binary,
    Search,
    Trash2,
    Sparkles,
    Globe,
    Layers,
    Plus,
    ChevronRight
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
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/ontology/Classes')({
    component: ClassesPage,
})

function ClassesPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentVersion, setCurrentVersion] = useState<OntologyVersion | null>(null);
    const { toast } = useToast();

    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [classProperties, setClassProperties] = useState<Property[]>([]);

    // Create dialog state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newParentId, setNewParentId] = useState<string>('');
    const [newIsAbstract, setNewIsAbstract] = useState(false);
    const [generatingDesc, setGeneratingDesc] = useState(false);

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
        if (selectedClass) {
            loadProperties(selectedClass.id);
        }
    }, [selectedClass]);

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
            if (classesData.length > 0 && !selectedClass) {
                // setSelectedClass(classesData[0]); // Optional: auto-select first
            }
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
            const newClass = await createClass({
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
            setSelectedClass(newClass);
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to create class" });
        }
    }

    async function handleUpdateClass() {
        if (!selectedClass) return;
        try {
            await updateClass(selectedClass.id, {
                description: selectedClass.description,
                parent_class_id: selectedClass.parent_class_id === "none" ? undefined : (selectedClass.parent_class_id || undefined),
                is_abstract: selectedClass.is_abstract
            });
            toast({ title: "Success", description: "Class updated successfully." });
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
            setSelectedClass(null);
            loadData();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete class" });
        }
    }

    async function handleSaveProperty() {
        if (!selectedClass || !currentVersion) return;
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
                class_id: selectedClass.id,
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
            loadProperties(selectedClass.id);
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
            if (selectedClass) loadProperties(selectedClass.id);
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
        <div className="h-full flex flex-col p-6">
            <div className="flex flex-col md:flex-row gap-8 h-full">
                {/* Left Side: Class List */}
                <div className="w-full md:w-80 flex flex-col space-y-4 h-full">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xl font-bold tracking-tight">Classes</h2>
                        <Badge variant="outline" className="text-xs font-normal">
                            {currentVersion?.version || 'Unknown'} Version
                        </Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search classes..."
                            className="pl-8 bg-background/50 border-border/40"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {loading ? (
                            <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
                        ) : filteredClasses.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border/40 rounded-xl">No classes found</div>
                        ) : (
                            filteredClasses.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedClass(item)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl transition-all border duration-200 group relative",
                                        selectedClass?.id === item.id
                                            ? "bg-orange-500/10 border-orange-500/30 shadow-sm"
                                            : "hover:bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                                selectedClass?.id === item.id ? "bg-orange-500/20 text-orange-600" : "bg-muted text-muted-foreground/70 group-hover:bg-muted/80"
                                            )}>
                                                <Layers className="h-4 w-4" />
                                            </div>
                                            <span className="font-semibold text-sm">{item.name}</span>
                                        </div>
                                        {item.parent_class_id && (
                                            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                                        )}
                                    </div>
                                    {item.is_abstract && (
                                        <Badge variant="secondary" className="mt-2 text-[9px] h-4 bg-background/50 text-muted-foreground border-border/40">Abstract</Badge>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full bg-orange-600 hover:bg-orange-700 shadow-md shadow-orange-500/10">
                                <Plus className="mr-2 h-4 w-4" /> New Class
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create Class</DialogTitle>
                                <DialogDescription>Define a new entity type.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Class Name</Label>
                                    <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Asset" />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="desc">Description</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px]"
                                            onClick={async () => {
                                                if (!newName) return;
                                                setGeneratingDesc(true);
                                                try {
                                                    const desc = await generateClassDescription(newName);
                                                    setNewDesc(desc);
                                                } finally { setGeneratingDesc(false); }
                                            }}
                                            disabled={!newName || generatingDesc}
                                        >
                                            <Sparkles className="mr-1 h-3 w-3" /> Auto-Generate
                                        </Button>
                                    </div>
                                    <Input id="desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Parent Class</Label>
                                    <Select value={newParentId} onValueChange={setNewParentId}>
                                        <SelectTrigger><SelectValue placeholder="Root Class" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None (Root)</SelectItem>
                                            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>Abstract</Label>
                                    <Switch checked={newIsAbstract} onCheckedChange={setNewIsAbstract} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateClass} className="bg-orange-600">Create</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Right Side: Detail Editor */}
                <div className="flex-1 overflow-hidden flex flex-col h-full rounded-2xl border border-border/40 bg-background/40 shadow-sm relative">
                    {selectedClass ? (
                        <>
                            <div className="flex-none p-6 border-b border-border/40 bg-background/50 backdrop-blur-sm flex items-start justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500/10 to-rose-500/10 border border-orange-500/20 flex items-center justify-center">
                                        <Layers className="h-6 w-6 text-orange-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                            {selectedClass.name}
                                            {selectedClass.is_abstract && <Badge variant="outline" className="font-normal text-xs text-muted-foreground">Abstract</Badge>}
                                        </h2>
                                        <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                                            <Globe className="h-3.5 w-3.5" />
                                            <span className="truncate max-w-md">{selectedClass.description || "No description provided."}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => handleDeleteClass(selectedClass.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete Class
                                    </Button>
                                    <Button size="sm" onClick={handleUpdateClass} className="bg-orange-600 hover:bg-orange-700">
                                        Save Changes
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {/* General Settings */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                        <Settings2 className="h-4 w-4 mr-2" /> Configuration
                                    </h3>
                                    <div className="grid gap-4 p-4 rounded-xl bg-secondary/20 border border-border/50">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Description</Label>
                                                <Input
                                                    value={selectedClass.description || ''}
                                                    onChange={e => setSelectedClass({ ...selectedClass, description: e.target.value })}
                                                    className="bg-background/80"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Parent Class</Label>
                                                <Select
                                                    value={selectedClass.parent_class_id || "none"}
                                                    onValueChange={(val) => setSelectedClass({ ...selectedClass, parent_class_id: val === "none" ? undefined : val })}
                                                >
                                                    <SelectTrigger className="bg-background/80">
                                                        <SelectValue placeholder="Select parent" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None (Root Class)</SelectItem>
                                                        {classes.filter(c => c.id !== selectedClass.id).map(c => (
                                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 pt-2">
                                            <Switch
                                                checked={selectedClass.is_abstract}
                                                onCheckedChange={v => setSelectedClass({ ...selectedClass, is_abstract: v })}
                                            />
                                            <Label className="text-sm font-normal">Abstract (cannot be instantiated directly)</Label>
                                        </div>
                                    </div>
                                </div>

                                {/* Properties */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                            <Binary className="h-4 w-4 mr-2" /> Properties
                                        </h3>
                                        <Button size="sm" variant="outline" onClick={() => setIsPropDialogOpen(true)} className="h-8 text-xs">
                                            <Plus className="h-3 w-3 mr-1" /> Add Property
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {classProperties.length === 0 ? (
                                            <div className="p-8 text-center border border-dashed rounded-xl text-muted-foreground text-sm">
                                                No properties defined for this class.
                                            </div>
                                        ) : (
                                            classProperties.map((prop) => (
                                                <div key={prop.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/40 hover:border-orange-500/30 transition-all group">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="h-8 w-8 rounded bg-secondary/50 flex items-center justify-center font-mono text-xs font-bold text-muted-foreground">
                                                            {prop.data_type.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center space-x-2">
                                                                <span className="font-semibold text-sm">{prop.name}</span>
                                                                {prop.is_required && <Badge className="h-4 text-[9px] px-1 bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">Required</Badge>}
                                                                {prop.is_unique && <Badge className="h-4 text-[9px] px-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">Unique</Badge>}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {prop.description || "No description"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditProperty(prop)}><Settings2 className="h-3.5 w-3.5" /></Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteProperty(prop.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <Layers className="h-16 w-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium">Select a class</h3>
                            <p className="text-sm">Choose a class from the list to view or edit details.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Property Dialog (Reused Logic) */}
            <Dialog open={isPropDialogOpen} onOpenChange={setIsPropDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingProperty ? 'Edit' : 'Add'} Property</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Name</Label>
                                <Input value={propName} onChange={e => setPropName(e.target.value)} placeholder="e.g. weight" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Type</Label>
                                <Select value={propType} onValueChange={setPropType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2"><Switch checked={propRequired} onCheckedChange={setPropRequired} /><Label>Required</Label></div>
                            <div className="flex items-center space-x-2"><Switch checked={propUnique} onCheckedChange={setPropUnique} /><Label>Unique</Label></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveProperty} disabled={isPropSaving} className="bg-orange-600">{editingProperty ? "Save" : "Add"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
