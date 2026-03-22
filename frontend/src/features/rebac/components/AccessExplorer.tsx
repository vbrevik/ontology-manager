
import { useState, useEffect } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Shield,
    ShieldCheck,
    ShieldAlert,
    Box,
    Unlock,
    MoreHorizontal,
    Search,
    Key,
    Activity,
    X,
    Bot,
    Database,
    Globe,
    FolderTree
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    createRelationship,
    deleteRelationship,
    fetchClasses,
    fetchEntities,
    fetchEntityRelationships,
    type RelationshipWithDetails,
    type Entity
} from '@/features/ontology/lib/api';
import { abacApi, type RolePermissionMatrix } from '@/features/abac/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { evaluatePermission } from '@/features/rebac/lib/permissionEngine';

type AccessStatus = 'granted' | 'denied' | 'inherited';

interface AccessExplorerProps {
    selectedRoleId?: string;
    readOnly?: boolean;
}

const CLASS_UI_CONFIG: Record<string, { icon: any, color: string, category: string }> = {
    'Project': { icon: Box, color: 'text-indigo-500', category: 'Core Projects' },
    'Task': { icon: Activity, color: 'text-amber-500', category: 'Core Projects' },
    'AiProvider': { icon: Bot, color: 'text-purple-500', category: 'AI Agents & Providers' },
    'Service': { icon: Database, color: 'text-blue-500', category: 'Infrastructure Services' },
    'ApiKey': { icon: Key, color: 'text-emerald-500', category: 'External Access & Webhooks' },
    'Webhook': { icon: Globe, color: 'text-sky-500', category: 'External Access & Webhooks' },
    'Folder': { icon: FolderTree, color: 'text-slate-400', category: 'General' },
};

export function AccessExplorer({ selectedRoleId, readOnly = false }: AccessExplorerProps) {
    const { toast } = useToast();
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, any>>>({});
    const [persistedOverrides, setPersistedOverrides] = useState<RelationshipWithDetails[]>([]);
    const [roleMatrix, setRoleMatrix] = useState<RolePermissionMatrix | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [selectedRoleId]);



    const loadData = async () => {
        setLoading(true);
        try {
            const [matrix, overrides, allClasses] = await Promise.all([
                abacApi.getRolePermissionMatrix(),
                selectedRoleId ? fetchEntityRelationships(selectedRoleId) : Promise.resolve([]),
                fetchClasses()
            ]);

            setRoleMatrix(matrix);
            setPersistedOverrides(overrides.filter(r => r.relationship_type_name === 'GRANTS_ACCESS'));

            // Fetch all entities for classes in our UI config
            const relevantClasses = allClasses.filter(c => CLASS_UI_CONFIG[c.name] || c.parent_class_id);
            const allEntitiesResults = await Promise.all(
                relevantClasses.map(c => fetchEntities({ class_id: c.id }))
            );

            const unifiedEntities = allEntitiesResults.flat();
            setEntities(unifiedEntities);
        } catch (error) {
            console.error('Failed to load explorer data:', error);
            toast({
                title: 'Error',
                description: 'Failed to load access explorer data',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedNodes);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpandedNodes(next);
    };

    const handleStatusChange = (entityId: string, permName: string, status: AccessStatus) => {
        setPendingChanges(prev => ({
            ...prev,
            [entityId]: {
                ...(prev[entityId] || {}),
                [permName]: status
            }
        }));
    };

    const renderEntityTree = (entity: Entity, level: number) => {
        const children = entities.filter(e => e.parent_entity_id === entity.id);
        const config = CLASS_UI_CONFIG[entity.class_name] || { icon: Shield, color: 'text-slate-400', category: 'General' };

        return (
            <div key={entity.id} className="flex flex-col">
                <EntityRow
                    entity={entity}
                    type={entity.class_name.toLowerCase() as any}
                    level={level}
                    expanded={expandedNodes.has(entity.id)}
                    onToggle={() => toggleExpand(entity.id)}
                    roleId={selectedRoleId}
                    readOnly={readOnly}
                    pendingChanges={pendingChanges}
                    persistedOverrides={persistedOverrides}
                    roleMatrix={roleMatrix}
                    onStatusChange={(status, perm) => handleStatusChange(entity.id, perm, status)}
                    uiConfig={config}
                />
                {expandedNodes.has(entity.id) && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                        {children.map(child => renderEntityTree(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const handleSaveChanges = async () => {
        if (!selectedRoleId) return;
        setIsSaving(true);
        try {
            const updates = Object.entries(pendingChanges);
            for (const [entityId, perms] of updates) {
                for (const [permName, status] of Object.entries(perms)) {


                    if (status === 'inherited') {
                        const existing = persistedOverrides.find(r =>
                            r.target_entity_id === entityId &&
                            r.metadata?.action === permName &&
                            !r.metadata?.field_name
                        );
                        if (existing) {
                            await deleteRelationship(existing.id);
                        }
                    } else {
                        await createRelationship({
                            source_entity_id: selectedRoleId,
                            target_entity_id: entityId,
                            relationship_type: 'GRANTS_ACCESS',
                            metadata: {
                                action: permName,
                                effect: status === 'granted' ? 'ALLOW' : 'DENY'
                            }
                        });
                    }
                }
            }
            setPendingChanges({});
            await loadData(); // Reload to refresh persisted state
            toast({
                title: "Changes Persisted",
                description: `Successfully synchronized ${Object.keys(pendingChanges).length} entity rule sets.`
            });
        } catch (err) {
            toast({
                title: "Synchronization Failed",
                description: err instanceof Error ? err.message : "Unknown error persists",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Activity className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-sm text-muted-foreground font-bold tracking-tight uppercase">Initializing Access Explorer...</p>
            </div>
        );
    }

    const pendingCount = Object.values(pendingChanges).reduce((acc, perms) => acc + Object.keys(perms).length, 0);

    return (
        <div className="flex flex-col space-y-4 h-full animate-in fade-in duration-500">
            <div className="flex items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-6 flex-1">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-indigo-500 transition-colors" />
                        <Input
                            placeholder="Find resource by name or ID..."
                            className="pl-11 h-12 bg-background/50 border-border/40 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-2xl transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <Badge variant="outline" className="h-10 px-4 bg-amber-500/10 text-amber-600 border-amber-500/20 font-black uppercase tracking-widest text-[10px] rounded-xl">
                                {pendingCount} Pending Changes
                            </Badge>
                            <Button
                                className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-500/20 rounded-xl"
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Persisting...' : 'Save Changes'}
                            </Button>
                            <Button
                                variant="outline"
                                className="h-10 px-4 border-border/40 font-black uppercase tracking-widest text-[10px] rounded-xl"
                                onClick={() => setPendingChanges({})}
                                disabled={isSaving}
                            >
                                <X className="h-4 w-4 mr-2" /> Cancel
                            </Button>
                        </div>
                    )}

                    <div className="h-10 w-px bg-border/20 mx-2" />

                </div>
            </div>

            <Card className="border-border/40 bg-background/20 backdrop-blur-sm overflow-hidden flex-1 flex flex-col shadow-2xl shadow-indigo-500/5 rounded-2xl">
                <div className="grid grid-cols-12 bg-muted/40 border-b border-border/40 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground/80 sticky top-0 z-20 backdrop-blur-md">
                    <div className="col-span-1 flex justify-center mr-4">
                    </div>
                    <div className="col-span-4 flex items-center">Resource Entity Structure</div>
                    <div className="col-span-1 text-center">Read</div>
                    <div className="col-span-1 text-center">Write</div>
                    <div className="col-span-1 text-center">Approve</div>
                    <div className="col-span-1 text-center">Delete</div>
                    <div className="col-span-3 text-right pr-4">Attributes & Rules</div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-border/20">
                    {Array.from(new Set(Object.values(CLASS_UI_CONFIG).map(c => c.category))).map(category => {
                        const categoryEntities = entities.filter(e => {
                            const config = CLASS_UI_CONFIG[e.class_name];
                            return config && config.category === category && !e.parent_entity_id;
                        });

                        if (categoryEntities.length === 0) return null;

                        const Config = Object.values(CLASS_UI_CONFIG).find(c => c.category === category);
                        const Icon = Config?.icon || Box;

                        return (
                            <div key={category} className="flex flex-col">
                                <div className="px-6 py-2 bg-muted/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                    <Icon className="h-3 w-3" /> {category}
                                </div>
                                {categoryEntities
                                    .filter(e => (e.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(entity => renderEntityTree(entity, 0))}
                            </div>
                        );
                    })}
                </div>

            </Card >
        </div >
    );
}

interface EntityRowProps {
    entity: Entity;
    type: string;
    level: number;
    expanded: boolean;
    onToggle: () => void;
    roleId?: string;
    readOnly?: boolean;
    pendingChanges?: Record<string, Record<string, any>>;
    persistedOverrides: RelationshipWithDetails[];
    roleMatrix: RolePermissionMatrix | null;
    onStatusChange?: (status: AccessStatus, perm: string) => void;
    uiConfig: { icon: any, color: string, category: string };
}

function EntityRow({
    entity, type, level, expanded, onToggle, roleId,
    readOnly, pendingChanges,
    persistedOverrides, roleMatrix, onStatusChange, uiConfig
}: EntityRowProps) {
    const entityPending = pendingChanges?.[entity.id] || {};

    // Evaluate base permissions from persisted state
    const evaluateBase = (permName: string, fieldName?: string) => {
        if (!roleMatrix) return { status: 'inherited' as AccessStatus };
        return evaluatePermission(entity.id, permName, {
            selectedRoleId: roleId,
            matrix: roleMatrix.roles,
            overrides: persistedOverrides,
            hierarchy: {} // Hierarchy fetching is a follow-up
        }, fieldName);
    };


    const hasPendingChanges = Object.keys(entityPending).length > 0;
    const hasPersistedOverrides = persistedOverrides.some(r => r.target_entity_id === entity.id);
    const hasOverrides = hasPendingChanges || hasPersistedOverrides;

    return (
        <div
            className={cn(
                "grid grid-cols-12 px-6 py-5 items-center hover:bg-indigo-500/[0.03] transition-all group relative",
                level > 0 && "bg-muted/[0.02]",
                hasOverrides && "border-l-4 border-indigo-500/50"
            )}
            data-entity-id={entity.id}
        >
            {level > 0 && (
                <div className="absolute left-10 top-0 bottom-0 w-px bg-border/40" />
            )}

            <div className="col-span-1 flex justify-center items-center mr-4">
            </div>

            <div className="col-span-4 flex items-center gap-4" style={{ paddingLeft: `${level * 40}px` }}>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                    onClick={onToggle}
                >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <div className={cn(
                    "p-2.5 rounded-2xl border-2 shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-0.5",
                    uiConfig.color.replace('text-', 'bg-').replace('500', '500/10'),
                    uiConfig.color.replace('text-', 'border-').replace('500', '500/20'),
                    uiConfig.color,
                    uiConfig.color.replace('text-', 'shadow-').replace('500', '500/10')
                )}>
                    {uiConfig.icon && <uiConfig.icon className="h-5 w-5" />}
                </div>
                <div className="flex flex-col truncate ml-1">
                    <span className="text-sm font-black tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                        {entity.display_name}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest">{type}</span>
                    </div>
                </div>
            </div>

            {/* Permission Toggles */}
            {['READ', 'WRITE', 'APPROVE', 'DELETE'].map((permName) => {
                const base = evaluateBase(permName);
                return (
                    <div key={permName} className="col-span-1 flex justify-center">
                        <PermissionToggle
                            permName={permName}
                            entityId={entity.id}
                            roleId={roleId}
                            parentEntity={entity}
                            readOnly={readOnly}
                            persistedStatus={base.status}
                            pendingStatus={entityPending[permName]}
                            onStatusChange={(status) => onStatusChange?.(status, permName)}
                        />
                    </div>
                );
            })}

            <div className="col-span-3 flex justify-end items-center gap-3">
                <Badge variant="outline" className="text-[9px] bg-background/50 border-border/40 text-muted-foreground/40 font-black uppercase tracking-tighter py-0.5 px-2 opacity-50">
                    Implicit Access
                </Badge>
            </div>
        </div>
    );
}


function PermissionToggle({ permName, entityId, roleId, parentEntity, readOnly, persistedStatus, pendingStatus, onStatusChange }: {
    permName: string,
    entityId: string,
    roleId?: string,
    parentEntity?: any,
    readOnly?: boolean,
    persistedStatus?: AccessStatus,
    pendingStatus?: AccessStatus,
    onStatusChange?: (status: AccessStatus) => void
}) {
    const status = pendingStatus || persistedStatus || 'inherited';

    // Simulate inheritance logic: If parent entity is granted, and we are inherited, we are granted.
    const effectiveStatus = (status === 'inherited' && parentEntity) ? 'granted' : status;

    const icons = {
        granted: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
        denied: <ShieldAlert className="h-5 w-5 text-rose-500" />,
        inherited: <Unlock className="h-5 w-5 text-muted-foreground/30" />
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => {
                            if (!roleId || readOnly) return;
                            const nextOrder: Record<AccessStatus, AccessStatus> = { inherited: 'granted', granted: 'denied', denied: 'inherited' };
                            const nextStatus = nextOrder[status];
                            onStatusChange?.(nextStatus);
                        }}
                        className={cn(
                            "p-3 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
                            effectiveStatus === 'granted' && "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5 hover:border-emerald-500/40 hover:scale-105 active:scale-95",
                            effectiveStatus === 'denied' && "bg-rose-500/5 border-rose-500/20 shadow-lg shadow-rose-500/5 hover:border-rose-500/40 hover:scale-105 active:scale-95",
                            effectiveStatus === 'inherited' && "border-transparent opacity-60 hover:border-border/40 hover:bg-muted/10"
                        )}
                        disabled={readOnly}
                        data-entity-id={entityId}
                    >
                        {status === 'inherited' && parentEntity && (
                            <div className="absolute top-0 right-0 h-2 w-2 bg-indigo-600 rounded-bl-sm animate-pulse" />
                        )}
                        {icons[effectiveStatus]}
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="border-border/40 shadow-2xl p-4 max-w-xs bg-background/95 backdrop-blur-md rounded-2xl">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] h-5 bg-indigo-500/10 text-indigo-600 border-indigo-500/20 uppercase font-black tracking-tight">
                                    {permName}
                                </Badge>
                            </div>
                            {readOnly && <Badge className="bg-amber-500/10 text-amber-600 text-[8px] h-4 font-black uppercase">Read Only</Badge>}
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-black tracking-tight flex items-center gap-2">
                                {effectiveStatus === 'granted' ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-rose-500" />}
                                {effectiveStatus.toUpperCase()} ACCESS
                            </p>
                            {status === 'inherited' && parentEntity ? (
                                <p className="text-[10px] text-indigo-600 font-bold leading-relaxed bg-indigo-500/5 p-2 rounded-xl border border-indigo-500/10">
                                    Effective access is <span className="underline">GRANTED</span> because it is inherited from parent resource: <strong className="font-black italic">"{parentEntity.display_name || parentEntity.name}"</strong>.
                                </p>
                            ) : status === 'inherited' ? (
                                <p className="text-[10px] text-muted-foreground/80 font-medium leading-relaxed">
                                    No explicit override found. Access is determined by systemic defaults or higher-level container assignments.
                                </p>
                            ) : (
                                <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
                                    Explicitly <span className={cn("font-black", status === 'denied' ? "text-rose-500" : "text-emerald-500")}>{status.toUpperCase()}</span> for this specific entry. This rule overrides all cascading permissions from parent objects.
                                </p>
                            )}
                        </div>
                        {!readOnly && (
                            <div className="pt-2 border-t border-border/20 mt-2">
                                <p className="text-[9px] text-indigo-600 font-black uppercase tracking-tighter flex items-center gap-1">
                                    <MoreHorizontal className="h-3 w-3" /> Click to toggle override levels
                                </p>
                            </div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider >
    );
}

