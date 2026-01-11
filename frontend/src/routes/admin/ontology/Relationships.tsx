
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, Pencil, Trash2, Share2, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox"
import {
    fetchRelationshipTypes,
    createRelationshipType,
    updateRelationshipType,
    deleteRelationshipType,
    type RelationshipType
} from "@/features/ontology/lib/api";

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
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingType, setEditingType] = useState<RelationshipType | null>(null);
    const { toast } = useToast();

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
        if (editingType) {
            form.reset({
                name: editingType.name,
                description: editingType.description || "",
                grants_permission_inheritance: editingType.grants_permission_inheritance,
            });
        } else {
            form.reset({
                name: "",
                description: "",
                grants_permission_inheritance: false,
            });
        }
    }, [editingType, form]);

    async function loadTypes() {
        try {
            setIsLoading(true);
            const data = await fetchRelationshipTypes();
            setTypes(data);
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

    function handleOpenCreate() {
        setEditingType(null);
        setIsDialogOpen(true);
    }

    function handleOpenEdit(type: RelationshipType) {
        setEditingType(type);
        setIsDialogOpen(true);
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            if (editingType) {
                await updateRelationshipType(editingType.id, {
                    description: values.description,
                    grants_permission_inheritance: values.grants_permission_inheritance
                });
                toast({
                    title: "Success",
                    description: "Relationship type updated successfully",
                });
            } else {
                await createRelationshipType(values);
                toast({
                    title: "Success",
                    description: "Relationship type created successfully",
                });
            }
            setIsDialogOpen(false);
            loadTypes();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: editingType
                    ? "Failed to update relationship type"
                    : "Failed to create relationship type",
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
            loadTypes();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete relationship type",
            });
        }
    }

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Relationship Types</h2>
                    <p className="text-muted-foreground mt-2">
                        Define the types of connections between ontology classes (e.g., "owns", "is part of").
                    </p>
                </div>
                <Button onClick={handleOpenCreate} className="gap-2">
                    <Plus className="h-4 w-4" /> New Type
                </Button>
            </div>

            <div className="border rounded-lg bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Inheritance</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : types.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No relationship types found. Create one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            types.map((type) => (
                                <TableRow key={type.id} className="group">
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <Share2 className="h-4 w-4 text-orange-500" />
                                        {type.name}
                                    </TableCell>
                                    <TableCell>{type.description || "-"}</TableCell>
                                    <TableCell>
                                        {type.grants_permission_inheritance && (
                                            <div className="flex items-center text-xs text-green-600 bg-green-100 dark:bg-green-900/30 w-fit px-2 py-1 rounded-full">
                                                <Check className="h-3 w-3 mr-1" />
                                                Inherits Permissions
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenEdit(type)}
                                            >
                                                <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(type.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingType ? "Edit Relationship Type" : "New Relationship Type"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingType
                                ? "Update the details of this relationship type."
                                : "Create a new relationship type for your ontology."}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. owns, manages" {...field} disabled={!!editingType} />
                                        </FormControl>
                                        <FormDescription>
                                            The unique identifier for this relationship type.
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
                                            <Input placeholder="Optional description" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="grants_permission_inheritance"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Grant Permission Inheritance
                                            </FormLabel>
                                            <FormDescription>
                                                If checked, permissions granted on the source entity will propagate to the target entity through this relationship.
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {editingType ? "Save Changes" : "Create Type"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
