
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
    abacApi,
    type Role,
    type PermissionType,
    type ImpactReport,
    type UserImpact
} from '@/features/abac/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, UserMinus, UserPlus, Users, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImpactSimulatorProps {
    roles: Role[];
    allPermissions: PermissionType[];
}

export function ImpactSimulator({ roles, allPermissions }: ImpactSimulatorProps) {
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [addedPerms, setAddedPerms] = useState<Set<string>>(new Set());
    const [removedPerms, setRemovedPerms] = useState<Set<string>>(new Set());

    // Fetch current permissions for the selected role to disable invalid choices
    const { data: currentRolePerms = [] } = useQuery({
        queryKey: ['rolePermissions', selectedRoleId],
        queryFn: () => abacApi.getRolePermissions(selectedRoleId),
        enabled: !!selectedRoleId,
    });

    const simulateMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRoleId) return null;
            return abacApi.simulateRoleChange({
                role_id: selectedRoleId,
                added_permissions: Array.from(addedPerms),
                removed_permissions: Array.from(removedPerms),
            });
        }
    });

    const handleToggleAdd = (permName: string) => {
        const next = new Set(addedPerms);
        if (next.has(permName)) next.delete(permName);
        else next.add(permName);
        setAddedPerms(next);
    };

    const handleToggleRemove = (permName: string) => {
        const next = new Set(removedPerms);
        if (next.has(permName)) next.delete(permName);
        else next.add(permName);
        setRemovedPerms(next);
    };

    const currentRolePermSet = new Set(
        currentRolePerms.map(p => p.action)
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            <Card className="lg:col-span-1 flex flex-col h-full bg-background/50 border-border/60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5 text-indigo-500" />
                        Simulation Config
                    </CardTitle>
                    <CardDescription>Select role and modifications.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div className="space-y-2">
                        <Label>Target Role</Label>
                        <Select value={selectedRoleId} onValueChange={(val) => {
                            setSelectedRoleId(val);
                            setAddedPerms(new Set());
                            setRemovedPerms(new Set());
                            simulateMutation.reset();
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role..." />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Tabs defaultValue="add" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="add" className="text-xs">Grant Access</TabsTrigger>
                            <TabsTrigger value="remove" className="text-xs">Revoke Access</TabsTrigger>
                        </TabsList>

                        <TabsContent value="add" className="flex-1 overflow-hidden mt-2 border rounded-md p-0">
                            <ScrollArea className="h-full pr-3 p-2">
                                <div className="space-y-2">
                                    {allPermissions.map(p => {
                                        const isOwned = currentRolePermSet.has(p.name);
                                        if (isOwned) return null; // Can't add if already has
                                        return (
                                            <div key={p.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md transition-colors">
                                                <Checkbox
                                                    id={`add-${p.id}`}
                                                    checked={addedPerms.has(p.name)}
                                                    onCheckedChange={() => handleToggleAdd(p.name)}
                                                />
                                                <label htmlFor={`add-${p.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1">
                                                    {p.name}
                                                    <span className="block text-[10px] text-muted-foreground font-normal line-clamp-1">{p.description}</span>
                                                </label>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="remove" className="flex-1 overflow-hidden mt-2 border rounded-md p-0">
                            <ScrollArea className="h-full pr-3 p-2">
                                <div className="space-y-2">
                                    {allPermissions.map(p => {
                                        const isOwned = currentRolePermSet.has(p.name);
                                        if (!isOwned) return null; // Can't remove if doesn't have
                                        return (
                                            <div key={p.id} className="flex items-center space-x-2 p-2 hover:bg-destructive/10 rounded-md transition-colors">
                                                <Checkbox
                                                    id={`rem-${p.id}`}
                                                    checked={removedPerms.has(p.name)}
                                                    onCheckedChange={() => handleToggleRemove(p.name)}
                                                    className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                                                />
                                                <label htmlFor={`rem-${p.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1">
                                                    {p.name}
                                                </label>
                                            </div>
                                        )
                                    })}
                                    {currentRolePermSet.size === 0 && selectedRoleId && (
                                        <div className="text-center text-xs text-muted-foreground py-4">
                                            Role has no permissions to revoke.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>

                    <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                        disabled={!selectedRoleId || (addedPerms.size === 0 && removedPerms.size === 0) || simulateMutation.isPending}
                        onClick={() => simulateMutation.mutate()}
                    >
                        {simulateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simulate Impact
                    </Button>
                </CardContent>
            </Card>

            <div className="lg:col-span-2 flex flex-col h-full space-y-4">
                {simulateMutation.data ? (
                    <ImpactResults report={simulateMutation.data} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-muted/5 opacity-60">
                        <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-xl font-medium text-foreground/80">Impact Analysis</h3>
                        <p className="text-muted-foreground text-center max-w-md mt-2">
                            Run a simulation to see how permission changes will affect your users.
                            We'll check for alternative access paths and redundancies.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ImpactResults({ report }: { report: ImpactReport }) {
    if (report.affected_users_count === 0) {
        return (
            <Alert className="bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Impact</AlertTitle>
                <AlertDescription>
                    This change affects 0 users. No one gains or loses access based on current assignments.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
                            <UserPlus className="h-6 w-6" />
                            {report.gained_access.length}
                        </CardTitle>
                        <CardDescription>Users Gaining Access</CardDescription>
                    </CardHeader>
                </Card>
                <Card className="bg-red-500/5 border-red-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
                            <UserMinus className="h-6 w-6" />
                            {report.lost_access.length}
                        </CardTitle>
                        <CardDescription>Users Losing Access</CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="py-4 border-b">
                    <CardTitle className="text-lg">Detailed User Impact</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="divide-y">
                            {report.gained_access.map(u => (
                                <UserImpactRow key={u.user_id} user={u} type="gain" />
                            ))}
                            {report.lost_access.map(u => (
                                <UserImpactRow key={u.user_id} user={u} type="loss" />
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}

function UserImpactRow({ user, type }: { user: UserImpact, type: 'gain' | 'loss' }) {
    return (
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center bg-muted",
                    type === 'gain' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                    {type === 'gain' ? <UserPlus className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
                </div>
                <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                        {user.display_name || 'Unknown User'}
                        <span className="text-xs text-muted-foreground font-normal">({user.email})</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        User ID: {user.user_id}
                    </div>
                </div>
            </div>
            <Badge variant={type === 'gain' ? 'outline' : 'secondary'} className={cn(
                type === 'gain' ? "text-emerald-600 border-emerald-200" : "text-red-500 bg-red-50"
            )}>
                {user.details}
            </Badge>
        </div>
    )
}
