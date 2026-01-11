
import { useEffect, useState } from "react";
import { fetchClasses, fetchEntities, type Entity, type Class, approveEntity, rejectEntity } from "@/features/ontology/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, Workflow } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ContextManagement() {
    const [contexts, setContexts] = useState<Entity[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadData = async () => {
        try {
            setLoading(true);
            const [fetchedClasses, fetchedContexts] = await Promise.all([
                fetchClasses(),
                fetchEntities({ is_root: true })
            ]);
            setClasses(fetchedClasses);
            setContexts(fetchedContexts);
        } catch (error) {
            console.error("Failed to load contexts:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load contexts."
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
            toast({
                title: "Approved",
                description: "Context approved successfully."
            });
            loadData();
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to approve context."
            });
        }
    };

    const handleReject = async (id: string) => {
        try {
            await rejectEntity(id);
            toast({
                title: "Rejected",
                description: "Context rejected successfully."
            });
            loadData();
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to reject context."
            });
        }
    };

    const getClassName = (classId: string) => {
        return classes.find(c => c.id === classId)?.name || classId;
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Workflow className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Context Management</h1>
                    <p className="text-muted-foreground">Approve or reject pending contexts.</p>
                </div>
            </div>

            <div className="grid gap-4">
                {contexts.length === 0 ? (
                    <div className="p-8 text-center border rounded-lg bg-muted/20">
                        <p className="text-muted-foreground">No contexts found.</p>
                    </div>
                ) : (
                    contexts.map((context) => (
                        <div key={context.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                            <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                    <h3 className="font-semibold">{context.display_name}</h3>
                                    <Badge variant="outline">{getClassName(context.class_id)}</Badge>
                                    <Badge
                                        variant={
                                            context.approval_status === "APPROVED" ? "default" :
                                                context.approval_status === "REJECTED" ? "destructive" : "secondary"
                                        }
                                        className={context.approval_status === "APPROVED" ? "bg-green-500 hover:bg-green-600" : ""}
                                    >
                                        {context.approval_status || "APPROVED"}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Created on {new Date(context.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            {context.approval_status === "PENDING" && (
                                <div className="flex items-center space-x-2">
                                    <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApprove(context.id)}>
                                        <Check className="h-4 w-4 mr-1" />
                                        Approve
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleReject(context.id)}>
                                        <X className="h-4 w-4 mr-1" />
                                        Reject
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
