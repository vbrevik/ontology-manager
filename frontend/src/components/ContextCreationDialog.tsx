
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { fetchClasses, fetchProperties, createEntity, type Class, type Property } from "@/features/ontology/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { EntityPropertyForm } from "@/features/ontology/components/EntityPropertyForm";

interface ContextCreationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onContextCreated: () => void;
}

export function ContextCreationDialog({ open, onOpenChange, onContextCreated }: ContextCreationDialogProps) {
    const [name, setName] = useState("");
    const [classId, setClassId] = useState("");
    const [classes, setClasses] = useState<Class[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [attributes, setAttributes] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [backendError, setBackendError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (open) {
            fetchClasses().then(setClasses).catch(console.error);
        } else {
            // Reset state on close
            setName("");
            setClassId("");
            setProperties([]);
            setAttributes({});
            setBackendError(null);
        }
    }, [open]);

    useEffect(() => {
        if (classId) {
            fetchProperties(classId).then(setProperties).catch(console.error);
            setAttributes({});
        }
    }, [classId]);

    async function handleCreate() {
        if (!name || !classId) return;

        setLoading(true);
        setBackendError(null);
        try {
            const createResult = await createEntity({
                class_id: classId,
                display_name: name,
                attributes: attributes
            });

            if ((createResult as any).approval_status === "PENDING") {
                toast({
                    title: "Context Submitted",
                    description: `"${name}" has been sent for approval.`
                });
            } else {
                toast({
                    title: "Context Created",
                    description: `Successfully created "${name}".`
                });
            }

            onContextCreated();
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            // Entity creation might fail with 400 Bad Request if validation rules fail
            let errorMessage = "Failed to create context. Please try again.";

            try {
                // If the error response has a JSON body with an "error" field (from our Axum route)
                const errorData = JSON.parse(error.message);
                if (errorData.error) errorMessage = errorData.error;
            } catch {
                if (error.message) errorMessage = error.message;
            }

            setBackendError(errorMessage);
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: errorMessage
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Context</DialogTitle>
                    <DialogDescription>
                        Create a new top-level entity (Root) to serve as an operational context.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Context Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Operation Alpha"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type">Context Type (Class)</Label>
                        <Select value={classId} onValueChange={setClassId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {classId && (
                        <div className="grid gap-2 border-t pt-4 mt-2">
                            <Label>Attributes</Label>
                            <EntityPropertyForm
                                properties={properties}
                                values={attributes}
                                onChange={setAttributes}
                            />
                        </div>
                    )}

                    {backendError && (
                        <div className="p-2 rounded bg-destructive/10 text-destructive text-[10px] font-medium border border-destructive/20 animate-in shake-1">
                            {backendError}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={!name || !classId || loading}>
                        {loading ? "Creating..." : "Create Context"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
