import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import {
    Plus,
    Trash2,
    Share2,
    Search,
    Settings2,
    ShieldCheck,
    Loader2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox"
import {
    fetchRelationshipTypes,
    createRelationshipType,
    updateRelationshipType,
    deleteRelationshipType,
    type RelationshipType
} from "@/features/ontology/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/ontology/Relationships")({
    component: RelationshipTypesPage,
});

const formSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    description: z.string().optional(),
    grants_permission_inheritance: z.boolean().default(false),
});

function RelationshipTypesPage() {
    const [types, setTypes] = useState<RelationshipType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedType, setSelectedType] = useState<RelationshipType | null>(null);
    const [search, setSearch] = useState('');
    const { toast } = useToast();

    // Create State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
            grants_permission_inheritance: false,
        },
    });

    useEffect(() => {
        loadTypes();
    }, []);

    useEffect(() => {
        if (selectedType) {
            form.reset({
                name: selectedType.name,
                description: selectedType.description || "",
                grants_permission_inheritance: selectedType.grants_permission_inheritance,
            });
        }
    }, [selectedType, form]);

    async function loadTypes() {
        try {
            setIsLoading(true);
            const data = await fetchRelationshipTypes();
            setTypes(data);
            if (data.length > 0 && !selectedType) {
                // Optional: auto-select first
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load relationship types",
            });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreate() {
        try {
            const newType = await createRelationshipType({
                name: newName,
                description: '',
                grants_permission_inheritance: false
            });
            toast({ title: "Success", description: "Relationship type created" });
            setIsCreateOpen(false);
            setNewName('');
            loadTypes();
            setSelectedType(newType);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to create type" });
        }
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!selectedType) return;
        try {
            await updateRelationshipType(selectedType.id, {
                description: values.description,
                grants_permission_inheritance: values.grants_permission_inheritance
            });
            toast({
                title: "Success",
                description: "Relationship type updated successfully",
            });
            loadTypes();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update relationship type",
            });
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this relationship type?")) return;
        try {
            await deleteRelationshipType(id);
            toast({
                title: "Success",
                description: "Relationship type deleted successfully",
            });
            setSelectedType(null);
            loadTypes();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete relationship type",
            });
        }
    }

    const filteredTypes = types.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex flex-col md:flex-row gap-8 h-full">
                {/* Left Side: List */}
                <div className="w-full md:w-80 flex flex-col space-y-4 h-full">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xl font-bold tracking-tight">Relationship Types</h2>
                        <Badge variant="outline" className="text-xs font-normal opacity-50">
                            {types.length} Types
                        </Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search types..."
                            className="pl-8 bg-background/50 border-border/40"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {isLoading ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                        ) : filteredTypes.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border/40 rounded-xl">No types found</div>
                        ) : (
                            filteredTypes.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedType(item)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl transition-all border duration-200 group relative",
                                        selectedType?.id === item.id
                                            ? "bg-rose-500/10 border-rose-500/30 shadow-sm"
                                            : "hover:bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                                selectedType?.id === item.id ? "bg-rose-500/20 text-rose-600" : "bg-muted text-muted-foreground/70 group-hover:bg-muted/80"
                                            )}>
                                                <Share2 className="h-4 w-4" />
                                            </div>
                                            <span className="font-semibold text-sm">{item.name}</span>
                                        </div>
                                        {item.grants_permission_inheritance && (
                                            <ShieldCheck className="h-3 w-3 text-green-500" />
                                        )}
                                    </div>
                                    <div className="mt-1 text-[10px] text-muted-foreground/60 pl-11 truncate">
                                        {item.description || "No description"}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/10">
                                <Plus className="mr-2 h-4 w-4" /> New Type
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create Relationship Type</DialogTitle>
                                <DialogDescription>Define a new graph edge type.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. managed_by" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreate} disabled={!newName} className="bg-rose-600">Create</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Right Side: Detail Editor */}
                <div className="flex-1 overflow-hidden flex flex-col h-full rounded-2xl border border-border/40 bg-background/40 shadow-sm relative">
                    {selectedType ? (
                        <div className="flex flex-col h-full">
                            <div className="flex-none p-6 border-b border-border/40 bg-background/50 backdrop-blur-sm flex items-start justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/20 flex items-center justify-center">
                                        <Share2 className="h-6 w-6 text-rose-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-foreground">
                                            {selectedType.name}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">Relationship Definition</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => handleDelete(selectedType.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Type
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                                <Settings2 className="h-4 w-4 mr-2" /> General Settings
                                            </h3>

                                            <div className="grid gap-6 p-6 rounded-xl bg-secondary/20 border border-border/50">
                                                <FormField
                                                    control={form.control}
                                                    name="name"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Type Name</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} disabled />
                                                            </FormControl>
                                                            <FormDescription>
                                                                Unique identifier for this edge type. To rename, please recreate.
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="description"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Description</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Describe the relationship purpose..." {...field} className="bg-background" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                                                <ShieldCheck className="h-4 w-4 mr-2" /> Security Propagation
                                            </h3>

                                            <div className="p-6 rounded-xl bg-secondary/20 border border-border/50">
                                                <FormField
                                                    control={form.control}
                                                    name="grants_permission_inheritance"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-lg p-0">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-base font-semibold">
                                                                    Permission Inheritance
                                                                </FormLabel>
                                                                <FormDescription className="text-xs max-w-sm">
                                                                    If enabled, permissions granted on the source entity will flow to the target entity through this relationship automatically.
                                                                </FormDescription>
                                                            </div>
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                    className="h-5 w-5"
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <Button type="submit" className="bg-rose-600 hover:bg-rose-700 w-32">
                                                Save Changes
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <Share2 className="h-16 w-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium">Select a relationship type</h3>
                            <p className="text-sm">Choose a type from the list to view or edit details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
