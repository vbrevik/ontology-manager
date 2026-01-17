
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { updateEntity, updateClass, getEntity, getClass } from '@/features/ontology/lib/api';

interface NodeEditSheetProps {
    nodeId: string | null;
    type: 'entity' | 'class' | 'context' | null;
    isOpen: boolean;
    onClose: () => void;
    onSaveSuccess: () => void;
}

export function NodeEditSheet({ nodeId, type, isOpen, onClose, onSaveSuccess }: NodeEditSheetProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, setData] = useState<any>(null); // Entity or Class

    // Form state
    const [displayName, setDisplayName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen && nodeId) {
            loadData();
        } else {
            // Reset
            setDisplayName('');
            setDescription('');
            setData(null);
        }
    }, [isOpen, nodeId]);

    async function loadData() {
        if (!nodeId || !type) return;
        setIsLoading(true);
        try {
            if (type === 'entity' || type === 'context') {
                const entity = await getEntity(nodeId);
                setData(entity);
                setDisplayName(entity.display_name);
                // Entity doesn't have description in the main interface shown in api.ts?
                // Checking api.ts Entity interface...
                // export interface Entity { ... display_name ... attributes ... }
                // No description field in Entity interface in api.ts.
            } else if (type === 'class') {
                const cls = await getClass(nodeId);
                setData(cls);
                setDisplayName(cls.name);
                setDescription(cls.description || '');
            }
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load details'
            });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSave() {
        if (!nodeId || !type) return;
        setIsSaving(true);
        try {
            if (type === 'entity' || type === 'context') {
                await updateEntity(nodeId, { display_name: displayName });
            } else if (type === 'class') {
                await updateClass(nodeId, { description });
            }
            toast({ title: "Saved", description: "Node updated successfully" });
            onSaveSuccess();
            onClose();
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to save changes'
            });
        } finally {
            setIsSaving(false);
        }
    }

    if (!nodeId) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle>Edit {type === 'class' ? 'Class' : 'Entity'}</SheetTitle>
                    <SheetDescription>
                        Make changes to the selected node.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-4">
                    {isLoading ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>

                            {type === 'class' && (
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <SheetFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? 'Saving...' : 'Save changes'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
