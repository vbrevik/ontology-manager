
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    abacApi,
    type RolePermissionMatrix,
    type RolePermissionUpdate
} from '@/features/abac/lib/api';
import { Save, AlertCircle, RotateCw } from 'lucide-react';

export function AccessMatrix() {
    const queryClient = useQueryClient();
    const [updates, setUpdates] = useState<RolePermissionUpdate[]>([]);

    const { data: matrix, isLoading, error } = useQuery<RolePermissionMatrix>({
        queryKey: ['rolePermissionMatrix'],
        queryFn: abacApi.getRolePermissionMatrix
    });

    const mutation = useMutation({
        mutationFn: abacApi.batchUpdateRolePermissions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rolePermissionMatrix'] });
            setUpdates([]);
        },
    });

    const togglePermission = (roleId: string, permissionName: string, currentStatus: boolean) => {
        // Check if we already have a pending update for this
        const existingUpdateIndex = updates.findIndex(
            u => u.role_id === roleId && u.permission === permissionName
        );

        let newUpdates = [...updates];

        if (existingUpdateIndex >= 0) {
            // If we are toggling back to original state, remove the update
            // Otherwise update the existing update
            const existing = updates[existingUpdateIndex];
            if (existing.grant === !currentStatus) {
                // This means we are flipping back to what it was in DB (assuming initial state didn't change in background)
                // Actually, simpler logic: just overwrite the update
                newUpdates[existingUpdateIndex] = { role_id: roleId, permission: permissionName, grant: !existing.grant };
            }
        } else {
            newUpdates.push({ role_id: roleId, permission: permissionName, grant: !currentStatus });
        }

        // Optimization: If the new state matches the original matrix state, we can remove the update entirely
        // But for now, let's just keep it simple. Local state 'wins' over DB state for UI rendering.

        setUpdates(newUpdates);
    };

    if (isLoading) return <div className="p-8 flex justify-center"><RotateCw className="animate-spin text-muted-foreground" /></div>;
    if (error) return <div className="p-4 text-red-500 flex items-center gap-2"><AlertCircle size={16} /> Failed to load matrix</div>;
    if (!matrix) return null;

    // Compute effective state (DB + Updates)
    const isPermissionGranted = (roleId: string, permissionName: string) => {
        const update = updates.find(u => u.role_id === roleId && u.permission === permissionName);
        if (update) return update.grant;

        const roleEntry = matrix.roles.find(r => r.role_id === roleId);
        return roleEntry?.permissions.includes(permissionName) || false;
    };

    const hasChanges = updates.length > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Access Matrix</h2>
                    <p className="text-sm text-muted-foreground">Manage role permissions globally.</p>
                </div>
                <button
                    onClick={() => mutation.mutate(updates)}
                    disabled={!hasChanges || mutation.isPending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${hasChanges
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                >
                    {mutation.isPending ? <RotateCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {hasChanges ? `Save ${updates.length} Changes` : 'No Changes'}
                </button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/40">
                            <th className="p-3 text-left font-medium min-w-[200px] sticky left-0 bg-background/95 backdrop-blur border-r z-10">Role</th>
                            {matrix.permission_types.map(perm => (
                                <th key={perm.id} className="p-3 text-center font-medium min-w-[100px] whitespace-nowrap" title={perm.description}>
                                    <div className="flex flex-col items-center">
                                        <span>{perm.name.split('.').pop()}</span>
                                        <span className="text-[10px] text-muted-foreground font-normal">{perm.name.split('.').slice(0, -1).join('.')}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.roles.map(role => (
                            <tr key={role.role_id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                <td className="p-3 font-medium sticky left-0 bg-background border-r z-10 flex items-center gap-2 group">
                                    {role.role_name}
                                </td>
                                {matrix.permission_types.map(perm => {
                                    const granted = isPermissionGranted(role.role_id, perm.name);
                                    const isModified = updates.some(u => u.role_id === role.role_id && u.permission === perm.name);

                                    return (
                                        <td key={`${role.role_id}-${perm.id}`} className="p-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={granted}
                                                onChange={() => togglePermission(role.role_id, perm.name, granted)}
                                                className={`w-4 h-4 rounded border-gray-300 transition-all ${isModified ? 'ring-2 ring-yellow-400 ring-offset-1' : ''
                                                    }`}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
