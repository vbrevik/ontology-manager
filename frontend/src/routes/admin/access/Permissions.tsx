import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
    fetchPermissionTypes,
    createPermissionType,
    updatePermissionType,
    deletePermissionType,
    type PermissionType
} from '@/features/ontology/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Plus,
    Trash2,
    Key,
    ChevronUp,
    ChevronDown,
    Activity,
    ShieldAlert,
    Info
} from 'lucide-react'
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

export const Route = createFileRoute('/admin/access/Permissions')({
    component: PermissionsPage,
})

function PermissionsPage() {
    const [types, setTypes] = useState<PermissionType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newType, setNewType] = useState({ name: '', description: '', level: 10 });
    const [permissionToDelete, setPermissionToDelete] = useState<PermissionType | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const data = await fetchPermissionTypes();
            // Sort by level ascending
            setTypes(data.sort((a, b) => a.level - b.level));
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load permission types"
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdateLevel(id: string, newLevel: number) {
        try {
            await updatePermissionType(id, { level: newLevel });
            loadData(); // Reload to re-sort
            toast({
                title: "Success",
                description: "Permission level updated",
            });
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update permission level",
            });
        }
    }

    const handleDeleteClick = (perm: PermissionType) => {
        setPermissionToDelete(perm);
    };

    const confirmDelete = async () => {
        if (!permissionToDelete) return;

        try {
            await deletePermissionType(permissionToDelete.id);
            setTypes(types.filter(t => t.id !== permissionToDelete.id));
            setPermissionToDelete(null);
            toast({
                title: "Deleted",
                description: "Permission type removed",
            });
        } catch (err) {
            console.error('Failed to delete permission:', err);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete permission type",
            });
        }
    };

    async function handleCreate() {
        try {
            const created = await createPermissionType(newType);
            setTypes([...types, created].sort((a, b) => a.level - b.level));
            setNewType({ name: '', description: '', level: 10 });
            setIsDialogOpen(false);
            toast({
                title: "Success",
                description: "New permission type created",
            });
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to create permission type. Name must be unique.",
            });
        }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Activity className="animate-spin h-8 w-8 text-indigo-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between bg-background/40 p-4 rounded-xl border border-border/40 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                    <Key className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-bold uppercase tracking-wider">Permission Hierarchy</span>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8">
                            <Plus className="mr-2 h-4 w-4" /> New Permission
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Permission Type</DialogTitle>
                            <DialogDescription>
                                Add a new granular access type to the system.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Internal Name (Uppercase)</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. READ_SENSITIVE, DELEGATE"
                                    value={newType.name}
                                    onChange={(e) => setNewType({ ...newType, name: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc">Description</Label>
                                <Input
                                    id="desc"
                                    placeholder="Briefly explain what this permission allows"
                                    value={newType.description}
                                    onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="level">Hierarchy Level (0-1000)</Label>
                                <Input
                                    id="level"
                                    type="number"
                                    value={newType.level}
                                    onChange={(e) => setNewType({ ...newType, level: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={!newType.name}>Create Permission</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {types.map((type, index) => (
                    <Card key={type.id} className="border-border/40 bg-background/40 hover:border-indigo-500/20 transition-all duration-200">
                        <CardHeader className="p-4 pb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                        <Key className="h-4 w-4 text-indigo-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold">{type.name}</CardTitle>
                                        <CardDescription className="text-xs">
                                            {type.description || "No description provided"}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Level</span>
                                        <Badge variant="secondary" className="px-3 py-1 font-mono text-sm bg-indigo-500/5 text-indigo-600 border-indigo-500/20">
                                            {type.level}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-col space-y-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleUpdateLevel(type.id, type.level + 10)}
                                        >
                                            <ChevronUp className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleUpdateLevel(type.id, Math.max(0, type.level - 10))}
                                        >
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors ml-2"
                                        onClick={() => handleDeleteClick(type)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            {index > 0 && (
                                <div className="flex items-center space-x-2 text-[10px] text-muted-foreground mt-2 italic">
                                    <ShieldAlert className="h-3 w-3" />
                                    <span>Satisfies requirements for <strong>{types[index - 1].name}</strong> and below.</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {types.length === 0 && !loading && (
                <div className="text-center py-20 border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
                    <Info className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-medium">No permission types defined</h3>
                    <p className="text-muted-foreground mt-2">
                        Build your security hierarchy by adding granular permission levels.
                    </p>
                </div>
            )}
        </div>
    );
}
