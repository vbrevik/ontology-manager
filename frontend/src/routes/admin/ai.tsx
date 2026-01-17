import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
    fetchAiModels,
    fetchEntities,
    updateEntity,
    fetchClasses,
    createEntity,
    type Entity
} from "@/features/ontology/lib/api";
import { useAi } from "@/features/ai/lib/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Sparkles,
    CheckCircle2,
    XCircle,
    RefreshCcw,
    Settings2,
    Cpu,
    Globe,
    Loader2,
    Activity,
    Plus
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute('/admin/ai')({
    component: AiSettings,
})

export default function AiSettings() {
    const { status, refreshStatus } = useAi();
    const [providers, setProviders] = useState<Entity[]>([]);
    const [models, setModels] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const { toast } = useToast();

    // Add Provider State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        display_name: "",
        provider_type: "Ollama",
        api_base: "http://localhost:11434/v1",
        model_name: "llama3",
        is_active: false
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const [fetchedEntities, fetchedClasses, fetchedModels] = await Promise.all([
                fetchEntities(),
                fetchClasses(),
                fetchAiModels().catch(() => [])
            ]);

            const aiProviderCls = fetchedClasses.find(c => c.name === 'AiProvider');
            if (aiProviderCls) {
                const aiProviders = fetchedEntities.filter(e => e.class_id === aiProviderCls.id);
                setProviders(aiProviders);
            }
            setModels(fetchedModels);
        } catch (error) {
            console.error("Failed to load AI settings:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load AI configuration."
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSwitchModel = async (providerId: string, modelName: string) => {
        setUpdating(true);
        try {
            const provider = providers.find(p => p.id === providerId);
            if (!provider) return;

            await updateEntity(providerId, {
                attributes: {
                    ...provider.attributes,
                    model_name: modelName
                }
            });

            toast({ title: "Success", description: `Model switched to ${modelName}.` });
            await refreshStatus();
            await loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update model." });
        } finally {
            setUpdating(false);
        }
    };

    const handleToggleActive = async (providerId: string, isActive: boolean) => {
        setUpdating(true);
        try {
            // First disable all
            if (isActive) {
                for (const p of providers.filter(p => (p.attributes as any).is_active)) {
                    await updateEntity(p.id, {
                        attributes: { ...p.attributes, is_active: false }
                    });
                }
            }

            const provider = providers.find(p => p.id === providerId);
            if (!provider) return;

            await updateEntity(providerId, {
                attributes: {
                    ...provider.attributes,
                    is_active: isActive
                }
            });

            toast({ title: "Success", description: `Provider ${isActive ? 'activated' : 'deactivated'}.` });
            await refreshStatus();
            await loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to toggle status." });
        } finally {
            setUpdating(false);
        }
    };

    const handleAddProvider = async () => {
        setUpdating(true);
        try {
            const fetchedClasses = await fetchClasses();
            const aiProviderCls = fetchedClasses.find(c => c.name === 'AiProvider');
            if (!aiProviderCls) throw new Error("AiProvider class not found");

            await createEntity({
                class_id: aiProviderCls.id,
                display_name: addForm.display_name,
                attributes: {
                    provider_type: addForm.provider_type,
                    api_base: addForm.api_base,
                    model_name: addForm.model_name,
                    is_active: addForm.is_active,
                    status: "Unhealthy"
                }
            });

            toast({ title: "Success", description: "AI Provider registered successfully." });
            setIsAddOpen(false);
            setAddForm({
                display_name: "",
                provider_type: "Ollama",
                api_base: "http://localhost:11434/v1",
                model_name: "llama3",
                is_active: false
            });
            await loadData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to register provider." });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">AI Orchestrator</h1>
                        <p className="text-muted-foreground">Manage AI providers and situational awareness models.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="border-indigo-500/20 text-indigo-600 hover:bg-indigo-50">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Provider
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Register AI Provider</DialogTitle>
                                <DialogDescription>Add a new LLM backend to the system ontology.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Name</Label>
                                    <Input className="col-span-3" value={addForm.display_name} onChange={e => setAddForm({ ...addForm, display_name: e.target.value })} placeholder="Local Ollama" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Type</Label>
                                    <select className="col-span-3 p-2 rounded-md border" value={addForm.provider_type} onChange={e => setAddForm({ ...addForm, provider_type: e.target.value })}>
                                        <option value="Ollama">Ollama</option>
                                        <option value="OpenAI">OpenAI</option>
                                        <option value="Anthropic">Anthropic</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">API Base</Label>
                                    <Input className="col-span-3" value={addForm.api_base} onChange={e => setAddForm({ ...addForm, api_base: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Model</Label>
                                    <Input className="col-span-3" value={addForm.model_name} onChange={e => setAddForm({ ...addForm, model_name: e.target.value })} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddProvider} disabled={updating || !addForm.display_name}>
                                    {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                    Register Provider
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={() => { refreshStatus(); loadData(); }}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-500" />
                            Live Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            {status.status === 'Healthy' ? (
                                <>
                                    <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/20">
                                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                    </div>
                                    <div>
                                        <Badge className="bg-emerald-500 hover:bg-emerald-600">Online</Badge>
                                        <p className="text-sm font-medium mt-2">{status.model}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]">{status.providerUrl}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="h-16 w-16 rounded-full bg-rose-500/10 flex items-center justify-center border-2 border-rose-500/20">
                                        <XCircle className="h-8 w-8 text-rose-500" />
                                    </div>
                                    <div>
                                        <Badge variant="destructive">Offline</Badge>
                                        <p className="text-xs text-muted-foreground mt-2">{status.message || "Provider unreachable"}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Globe className="h-4 w-4 text-indigo-500" />
                                Registered Providers
                                <Badge variant="secondary" className="ml-auto">{providers.length}</Badge>
                            </CardTitle>
                            <CardDescription>
                                Configure and switch between different LLM backends.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {providers.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic py-4 text-center">No providers registered in ontology.</p>
                            ) : (
                                providers.map((p) => (
                                    <div key={p.id} className={cn(
                                        "p-4 rounded-xl border transition-all",
                                        (p.attributes as any).is_active ? "border-indigo-500 bg-indigo-500/[0.03]" : "bg-muted/30"
                                    )}>
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{p.display_name}</span>
                                                    <Badge variant="outline" className="text-[10px] font-mono">{(p.attributes as any).provider_type}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{(p.attributes as any).api_base}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant={(p.attributes as any).is_active ? "default" : "outline"}
                                                className={(p.attributes as any).is_active ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                                                onClick={() => handleToggleActive(p.id, !(p.attributes as any).is_active)}
                                                disabled={updating}
                                            >
                                                {(p.attributes as any).is_active ? "Active" : "Activate"}
                                            </Button>
                                        </div>

                                        {(p.attributes as any).is_active && (
                                            <div className="mt-4 pt-4 border-t border-indigo-500/10 space-y-3">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 space-y-1.5">
                                                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Default Model</label>
                                                        {models.length > 0 ? (
                                                            <Select
                                                                value={(p.attributes as any).model_name}
                                                                onValueChange={(val) => handleSwitchModel(p.id, val)}
                                                                disabled={updating}
                                                            >
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue placeholder="Select model..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {/* Always include current model */}
                                                                    <SelectItem value={(p.attributes as any).model_name}>
                                                                        {(p.attributes as any).model_name} (Current)
                                                                    </SelectItem>
                                                                    {/* Add other discovered models */}
                                                                    {models
                                                                        .filter(m => m !== (p.attributes as any).model_name)
                                                                        .map(m => (
                                                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                                                        ))
                                                                    }
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    className="h-9 flex-1"
                                                                    placeholder="Enter model name (e.g. llama3)"
                                                                    defaultValue={(p.attributes as any).model_name}
                                                                    onBlur={(e) => {
                                                                        const newModel = e.target.value.trim();
                                                                        if (newModel && newModel !== (p.attributes as any).model_name) {
                                                                            handleSwitchModel(p.id, newModel);
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const newModel = (e.target as HTMLInputElement).value.trim();
                                                                            if (newModel && newModel !== (p.attributes as any).model_name) {
                                                                                handleSwitchModel(p.id, newModel);
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={updating}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                                        <Cpu className="h-4 w-4 text-indigo-600" />
                                                    </div>
                                                </div>
                                                {models.length === 0 && (
                                                    <p className="text-[10px] text-amber-600">
                                                        ⚠ Could not auto-discover models. Enter model name manually.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="h-4 w-4 text-indigo-500" />
                                System Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                All AI providers are stored as <strong>AiProvider</strong> entities within the system ontology.
                                Changes here are applied globally across the application.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
