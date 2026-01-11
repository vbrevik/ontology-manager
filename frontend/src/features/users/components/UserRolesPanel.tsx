import { useState, useEffect } from 'react';
import type { UserRoleAssignment, Role, Resource } from '@/features/abac/lib/api';
import { abacApi } from '@/features/abac/lib/api';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ShieldCheck, Box } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Assuming Select component might not be fully installed/configured, using native select for reliability
// If shadcn Select is available, I'd use it, but for now native is safer without verifying all UI components.

export function UserRolesPanel({ userId }: { userId: string }) {
    const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedResource, setSelectedResource] = useState(''); // Empty string = global (null)

    const fetchData = async () => {
        setLoading(true);
        try {
            const [userRoles, allRoles, allResources] = await Promise.all([
                abacApi.getUserRoles(userId),
                abacApi.listRoles(),
                abacApi.listResources()
            ]);
            setAssignments(userRoles);
            setRoles(allRoles);
            setResources(allResources);
        } catch (err: any) {
            setError('Failed to load access control data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userId]);

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRole) return;

        try {
            await abacApi.assignRole(
                userId,
                selectedRole,
                selectedResource === '' ? null : selectedResource
            );
            // Refresh
            const updated = await abacApi.getUserRoles(userId);
            setAssignments(updated);
            // Reset form
            setSelectedRole('');
            setSelectedResource('');
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to assign role');
        }
    };

    const handleRemove = async (assignmentId: string) => {
        try {
            await abacApi.removeRole(assignmentId);
            setAssignments(prev => prev.filter(a => a.id !== assignmentId));
        } catch (err: any) {
            setError('Failed to remove role assignment');
        }
    };

    if (loading) return <div className="p-4 text-center text-xs text-muted-foreground">Loading permissions...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Role Assignments</h3>
            </div>

            {error && (
                <Alert variant="destructive" className="py-2 px-3">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                {assignments.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded border border-dashed text-center">
                        No roles assigned to this user.
                    </div>
                ) : (
                    assignments.map(a => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded border bg-card text-sm group hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                    <span className="font-medium flex items-center gap-1.5">
                                        <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                                        {a.role_name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        {a.resource_name ? (
                                            <>
                                                <Box className="h-3 w-3" />
                                                Running on {a.resource_name}
                                            </>
                                        ) : (
                                            <span className="italic">Global Scope</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemove(a.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleAssign} className="p-3 bg-muted/30 rounded border space-y-3">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Assign Role</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label className="text-[10px]">Role</Label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedRole}
                            onChange={e => setSelectedRole(e.target.value)}
                            required
                        >
                            <option value="">Select a role...</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px]">Scope (Optional)</Label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedResource}
                            onChange={e => setSelectedResource(e.target.value)}
                        >
                            <option value="">Global (All Resources)</option>
                            {resources.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.resource_type})</option>
                            ))}
                        </select>
                    </div>
                </div>
                <Button type="submit" size="sm" className="w-full h-8" disabled={!selectedRole}>
                    <Plus className="h-3 w-3 mr-1" /> Assign Role
                </Button>
            </form>
        </div>
    );
}
