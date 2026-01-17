
import { useState, useEffect } from "react";
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, ShieldAlert, Plus } from "lucide-react";
import { simulateRoleChange, fetchRoles, fetchPermissionTypes, type Role, type ImpactReport, type PermissionType } from "@/features/ontology/lib/api";

export const Route = createFileRoute('/admin/access/impact')({
    component: ImpactAnalysisPage,
});

function ImpactAnalysisPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [currentPermissions, setCurrentPermissions] = useState<string[]>([]);

    // Simulation inputs
    const [permissionsToRemove, setPermissionsToRemove] = useState<string[]>([]);
    const [permissionsToAdd, setPermissionsToAdd] = useState<string[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionType[]>([]);

    const [simulationResult, setSimulationResult] = useState<ImpactReport | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadRoles();
        loadAllPermissions();
    }, []);

    useEffect(() => {
        if (selectedRole) {
            loadPermissions(selectedRole);
            setSimulationResult(null);
            setPermissionsToRemove([]);
            setPermissionsToAdd([]);
        }
    }, [selectedRole]);

    async function loadAllPermissions() {
        try {
            const perms = await fetchPermissionTypes();
            setAllPermissions(perms);
        } catch (e) {
            console.error("Failed to load permissions", e);
        }
    }

    async function loadRoles() {
        try {
            const data = await fetchRoles();
            setRoles(data);
        } catch (e) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load roles"
            });
        }
    }

    async function loadPermissions(roleId: string) {
        try {
            const res = await fetch(`/api/rebac/roles/${roleId}/permissions`);
            const data = await res.json();
            setCurrentPermissions(data);
        } catch (e) {
            console.error(e);
        }
    }

    function togglePermissionToRemove(perm: string) {
        setPermissionsToRemove(prev =>
            prev.includes(perm)
                ? prev.filter(p => p !== perm)
                : [...prev, perm]
        );
    }

    async function handleSimulate() {
        if (!selectedRole) return;
        setLoading(true);
        try {
            const report = await simulateRoleChange({
                role_id: selectedRole,
                removed_permissions: permissionsToRemove,
                added_permissions: permissionsToAdd
            });
            setSimulationResult(report);
        } catch (e) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Simulation failed"
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-border/40 bg-background/60">
                        <CardHeader>
                            <CardTitle>Simulation Scenario</CardTitle>
                            <CardDescription>
                                Defines the changes to test.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select Scope / Role</Label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
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

                            {selectedRole && (
                                <div className="space-y-6 pt-4 animate-in fade-in">
                                    {/* Revoke Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Simulate Revoking
                                            </Label>
                                            <span className="text-xs text-muted-foreground">{permissionsToRemove.length} selected</span>
                                        </div>
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 border rounded-md p-2 bg-background/40">
                                            {currentPermissions.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic p-2">No permissions assigned to this role.</p>
                                            ) : (
                                                currentPermissions.map(perm => (
                                                    <div key={perm} className="flex items-center space-x-2 p-1 rounded hover:bg-muted/50 cursor-pointer" onClick={() => togglePermissionToRemove(perm)}>
                                                        <Checkbox checked={permissionsToRemove.includes(perm)} onCheckedChange={() => togglePermissionToRemove(perm)} />
                                                        <span className={`text-sm ${permissionsToRemove.includes(perm) ? 'text-destructive line-through opacity-70' : ''}`}>
                                                            {perm}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Grant Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Simulate Granting
                                            </Label>
                                            <span className="text-xs text-muted-foreground">{permissionsToAdd.length} selected</span>
                                        </div>
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 border rounded-md p-2 bg-background/40">
                                            {allPermissions.filter(p => !currentPermissions.includes(p.name)).length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic p-2">No available permissions to add.</p>
                                            ) : (
                                                allPermissions
                                                    .filter(p => !currentPermissions.includes(p.name))
                                                    .map(perm => (
                                                        <div key={perm.id} className="flex items-center space-x-2 p-1 rounded hover:bg-muted/50 cursor-pointer" onClick={() => {
                                                            setPermissionsToAdd(prev => prev.includes(perm.name) ? prev.filter(p => p !== perm.name) : [...prev, perm.name])
                                                        }}>
                                                            <Checkbox checked={permissionsToAdd.includes(perm.name)} onCheckedChange={() => { }} />
                                                            <span className={`text-sm ${permissionsToAdd.includes(perm.name) ? 'text-green-600 font-medium' : ''}`}>
                                                                {perm.name}
                                                            </span>
                                                        </div>
                                                    ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700"
                                disabled={!selectedRole || (permissionsToRemove.length === 0 && permissionsToAdd.length === 0) || loading}
                                onClick={handleSimulate}
                            >
                                {loading ? "Simulating..." : "Run Simulation"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2">
                    {simulationResult ? (
                        <Card className="border-border/40 bg-background/60 h-full animate-in slide-in-from-right-4 duration-500">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle>Impact Report</CardTitle>
                                    <CardDescription>
                                        Analysis of removing {permissionsToRemove.length} permissions from role.
                                    </CardDescription>
                                </div>
                                <Badge variant={simulationResult.affected_users_count > 0 ? "destructive" : "secondary"}>
                                    {simulationResult.affected_users_count} Users Affected
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <Separator className="my-4" />

                                <div className="space-y-6">
                                    {/* Users Losing Access */}
                                    <div>
                                        <h4 className="text-sm font-semibold flex items-center mb-3 text-destructive">
                                            <ShieldAlert className="h-4 w-4 mr-2" />
                                            Users Losing Access
                                        </h4>
                                        {simulationResult.lost_access.length === 0 ? (
                                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                                                No users will lose access based on this change. They hold these permissions via other roles.
                                            </div>
                                        ) : (
                                            <div className="grid gap-2">
                                                {simulationResult.lost_access.map((impact, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-xs">
                                                                {impact.display_name?.[0] || 'U'}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium">{impact.display_name || impact.email || 'Unknown User'}</div>
                                                                <div className="text-[10px] text-muted-foreground">ID: {impact.user_id}</div>
                                                                {impact.email && <div className="text-[10px] text-muted-foreground">{impact.email}</div>}
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 text-[10px]">
                                                            {impact.details}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Users Gaining Access (if implemented) */}
                                    {simulationResult.gained_access.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-semibold flex items-center mb-3 text-green-600">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Users Gaining Access
                                            </h4>
                                            <div className="grid gap-2">
                                                {simulationResult.gained_access.map((impact, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                                                        <div className="text-sm">{impact.display_name}</div>
                                                        <Badge variant="outline" className="text-green-600 border-green-500/20 bg-green-500/5 text-[10px]">
                                                            {impact.details}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-xl bg-muted/5 min-h-[400px]">
                            <AlertCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium text-muted-foreground">No simulation run yet</h3>
                            <p className="text-sm text-muted-foreground/60 max-w-xs text-center mt-2">
                                Configure the scenario on the left and run simulation to see the breakdown of affected users.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
