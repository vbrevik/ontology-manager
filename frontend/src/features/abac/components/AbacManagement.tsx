import { useState, useEffect } from 'react';
import type { Role, Resource, Permission } from '../lib/api';
import { abacApi } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Box, Plus, Trash2, Key } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AbacManagement() {
    const [activeTab, setActiveTab] = useState<'roles' | 'resources'>('roles');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Access Control (ABAC)</h2>
                    <p className="text-muted-foreground">Manage roles, permissions, and resources.</p>
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'roles' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Roles & Permissions
                    </button>
                    <button
                        onClick={() => setActiveTab('resources')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'resources' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Resources
                    </button>
                </div>
            </div>

            {activeTab === 'roles' ? <RolesTab /> : <ResourcesTab />}
        </div>
    );
}

function RolesTab() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');

    const fetchRoles = async () => {
        try {
            const data = await abacApi.listRoles();
            setRoles(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await abacApi.createRole(newRoleName, newRoleDesc || undefined);
            setNewRoleName('');
            setNewRoleDesc('');
            setIsCreating(false);
            fetchRoles();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            {/* Roles List */}
            <Card className="md:col-span-1 border-border/60 flex flex-col">
                <CardHeader className="py-4 border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Roles</CardTitle>
                        <Button size="sm" variant="ghost" onClick={() => setIsCreating(true)}><Plus className="h-4 w-4" /></Button>
                    </div>
                </CardHeader>
                <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                        {isCreating && (
                            <form onSubmit={handleCreateRole} className="p-3 border rounded-lg bg-muted/30 space-y-3 mb-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Name</Label>
                                    <Input
                                        value={newRoleName}
                                        onChange={e => setNewRoleName(e.target.value)}
                                        placeholder="e.g. moderator"
                                        className="h-8 text-sm"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Description</Label>
                                    <Input
                                        value={newRoleDesc}
                                        onChange={e => setNewRoleDesc(e.target.value)}
                                        placeholder="Optional"
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button type="submit" size="sm" className="w-full">Create</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)}>Cancel</Button>
                                </div>
                            </form>
                        )}

                        {roles.map(role => (
                            <button
                                key={role.id}
                                onClick={() => setSelectedRole(role)}
                                className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 ${selectedRole?.id === role.id ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-card border-border/40'
                                    }`}
                            >
                                <div className="flex items-center gap-2 font-medium">
                                    <Shield className="h-4 w-4 text-primary" />
                                    {role.name}
                                </div>
                                {role.description && <p className="text-xs text-muted-foreground mt-1 ml-6">{role.description}</p>}
                            </button>
                        ))}
                        {roles.length === 0 && !loading && (
                            <div className="text-center p-4 text-muted-foreground text-sm">No roles found</div>
                        )}
                    </div>
                </ScrollArea>
            </Card>

            {/* Permissions Panel */}
            <Card className="md:col-span-2 border-border/60 flex flex-col">
                {selectedRole ? (
                    <PermissionsEditor role={selectedRole} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                        <Shield className="h-12 w-12 mb-4 opacity-20" />
                        <p>Select a role to manage its permissions</p>
                    </div>
                )}
            </Card>
        </div>
    );
}

function PermissionsEditor({ role }: { role: Role }) {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAction, setNewAction] = useState('');

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const data = await abacApi.getRolePermissions(role.id);
            setPermissions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, [role.id]);

    const handleAddPermission = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAction.trim()) return;
        try {
            await abacApi.addPermission(role.id, newAction.trim());
            setNewAction('');
            fetchPermissions();
        } catch (error) {
            console.error(error);
        }
    };

    const handleRemovePermission = async (permId: string) => {
        try {
            await abacApi.removePermission(permId);
            setPermissions(prev => prev.filter(p => p.id !== permId));
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <>
            <CardHeader className="py-4 border-b">
                <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                        <CardTitle className="text-lg">Permissions for <span className="text-primary">{role.name}</span></CardTitle>
                        <CardDescription>{role.description || 'No description'}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <ScrollArea className="flex-1 p-4 md:p-6">
                <div className="space-y-6">
                    <form onSubmit={handleAddPermission} className="flex gap-3 items-end">
                        <div className="flex-1 space-y-1.5">
                            <Label>Add Permission</Label>
                            <Input
                                value={newAction}
                                onChange={e => setNewAction(e.target.value)}
                                placeholder="e.g. project:read or *"
                            />
                            <p className="text-[11px] text-muted-foreground">Type an action string. Use '*' for full access.</p>
                        </div>
                        <Button type="submit" disabled={!newAction.trim()}>Add</Button>
                    </form>

                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Permissions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {permissions.map(perm => (
                                <div key={perm.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/20 group hover:border-primary/30 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Key className="h-3 w-3 text-muted-foreground" />
                                        <code className="text-sm font-mono text-foreground/90">{perm.action}</code>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleRemovePermission(perm.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                            {permissions.length === 0 && !loading && (
                                <div className="col-span-full py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                    No permissions assigned yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </>
    );
}

function ResourcesTab() {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('project');

    const fetchResources = async () => {
        try {
            const data = await abacApi.listResources();
            setResources(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();
    }, []);

    const handleCreateComp = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await abacApi.createResource(newName, newType);
            setNewName('');
            setIsCreating(false);
            fetchResources();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Resources</CardTitle>
                    <CardDescription>Scopes for assigning permissions (e.g. projects, teams).</CardDescription>
                </div>
                <Button onClick={() => setIsCreating(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> New Resource
                </Button>
            </CardHeader>
            <CardContent>
                {isCreating && (
                    <form onSubmit={handleCreateComp} className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Resource Name (Unique ID)</Label>
                                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. project:alpha" autoFocus />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Type</Label>
                                <Input value={newType} onChange={e => setNewType(e.target.value)} placeholder="e.g. project" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                            <Button type="submit">Create Resource</Button>
                        </div>
                    </form>
                )}

                <div className="border rounded-md divide-y">
                    <div className="grid grid-cols-3 bg-muted/50 p-3 text-sm font-medium">
                        <div>Name</div>
                        <div>Type</div>
                        <div>Created</div>
                    </div>
                    {resources.map(res => (
                        <div key={res.id} className="grid grid-cols-3 p-3 text-sm items-center hover:bg-muted/10 transition-colors">
                            <div className="font-mono flex items-center gap-2">
                                <Box className="h-4 w-4 text-muted-foreground" />
                                {res.name}
                            </div>
                            <div className="inline-flex">
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                                    {res.resource_type}
                                </span>
                            </div>
                            <div className="text-muted-foreground text-xs">
                                {new Date(res.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                    {resources.length === 0 && !loading && (
                        <div className="p-8 text-center text-muted-foreground">No resources found.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
