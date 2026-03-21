import { useState, useEffect } from 'react';
import type { UserRoleAssignment, Role, Resource } from '@/features/abac/lib/api';
import { abacApi } from '@/features/abac/lib/api';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ShieldCheck, Box, Clock, Calendar, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { TemporalRoleForm } from '@/features/rebac/components/TemporalRoleForm';
import { AccessExplorer } from '@/features/rebac/components/AccessExplorer';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';


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
    const [editingAssignment, setEditingAssignment] = useState<UserRoleAssignment | null>(null);

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

    const handleUpdateSchedule = async (data: any) => {
        if (!editingAssignment) return;

        try {
            await abacApi.updateRoleSchedule(editingAssignment.id, {
                valid_from: data.validFrom?.toISOString(),
                valid_until: data.validUntil?.toISOString(),
                schedule_cron: data.scheduleCron
            });

            // Optimistic update
            setAssignments(prev => prev.map(a =>
                a.id === editingAssignment.id
                    ? { ...a, valid_from: data.validFrom?.toISOString(), valid_until: data.validUntil?.toISOString(), schedule_cron: data.scheduleCron }
                    : a
            ));

            setEditingAssignment(null);
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError("Failed to update schedule.");
        }
    };

    // Helper to determine temporal status
    const getTemporalStatus = (a: any) => {
        const now = new Date();
        if (a.valid_from && new Date(a.valid_from) > now) return 'scheduled';
        if (a.valid_until && new Date(a.valid_until) < now) return 'expired';
        // Check cron if needed, for now simplified
        if (a.schedule_cron) return 'recurring';
        return 'active';
    };

    if (loading) return <div className="p-4 text-center text-xs text-muted-foreground">Loading permissions...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Role Assignments</h3>
                </div>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] border-indigo-500/20 bg-indigo-500/5 text-indigo-600">
                            <Eye className="mr-2 h-3.5 w-3.5" /> Explore Access
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-4 overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                                Effective Access Explorer
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-hidden mt-4">
                            <AccessExplorer readOnly />
                        </div>
                    </DialogContent>
                </Dialog>
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
                    assignments.map(a => {
                        const status = getTemporalStatus(a);

                        return (
                            <div key={a.id} className="flex items-center justify-between p-3 rounded border bg-card text-sm group hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                            {a.role_name}
                                            {status === 'active' && <Badge variant="outline" className="text-[10px] h-4 text-green-600 border-green-200 bg-green-50">Active</Badge>}
                                            {status === 'scheduled' && <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-200 bg-amber-50">Scheduled</Badge>}
                                            {status === 'expired' && <Badge variant="outline" className="text-[10px] h-4 text-red-600 border-red-200 bg-red-50">Expired</Badge>}
                                            {status === 'recurring' && <Badge variant="outline" className="text-[10px] h-4 text-blue-600 border-blue-200 bg-blue-50">Recurring</Badge>}
                                        </span>
                                        <div className="flex flex-col gap-0.5 ml-6">
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                {a.resource_name ? (
                                                    <>
                                                        <Box className="h-3 w-3" />
                                                        Scope: {a.resource_name}
                                                    </>
                                                ) : (
                                                    <span className="italic flex items-center gap-1"><Box className="h-3 w-3" /> Global Scope</span>
                                                )}
                                            </span>
                                            {/* Temporal Details */}
                                            {(a as any).valid_from && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    From: {format(new Date((a as any).valid_from), 'PP')}
                                                </span>
                                            )}
                                            {(a as any).schedule_cron && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Cron: {(a as any).schedule_cron}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingAssignment(a)}>
                                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Edit Schedule</DialogTitle>
                                            </DialogHeader>
                                            <div className="py-4">
                                                <TemporalRoleForm
                                                    // @ts-ignore
                                                    initialData={{
                                                        validFrom: (a as any).valid_from ? new Date((a as any).valid_from) : undefined,
                                                        validUntil: (a as any).valid_until ? new Date((a as any).valid_until) : undefined,
                                                        scheduleCron: (a as any).schedule_cron
                                                    }}
                                                    onSubmit={handleUpdateSchedule}
                                                />
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemove(a.id)}
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive transition-opacity"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })
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
