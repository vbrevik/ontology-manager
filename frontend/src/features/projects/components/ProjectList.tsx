import { useState, useEffect } from 'react';
import { listProjects, createProject, type Project, type CreateProjectInput } from '../lib/api';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Folder, Calendar, AlertCircle, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
    planning: { color: 'bg-blue-500', label: 'Planning', variant: 'default' as const },
    active: { color: 'bg-green-500', label: 'Active', variant: 'default' as const },
    on_hold: { color: 'bg-yellow-500', label: 'On Hold', variant: 'secondary' as const },
    completed: { color: 'bg-green-600', label: 'Completed', variant: 'default' as const },
    archived: { color: 'bg-gray-500', label: 'Archived', variant: 'outline' as const },
};

export function ProjectList() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newProject, setNewProject] = useState<CreateProjectInput>({ 
        name: '', 
        description: '', 
        status: 'planning' 
    });
    const navigate = useNavigate();

    useEffect(() => {
        loadProjects();
    }, []);

    async function loadProjects() {
        try {
            setLoading(true);
            const data = await listProjects();
            setProjects(data.projects);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load projects');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateProject(e: React.FormEvent) {
        e.preventDefault();
        if (!newProject.name.trim()) {
            setError('Project name is required');
            return;
        }
        
        try {
            setCreating(true);
            setError(null);
            await createProject(newProject);
            setShowCreateModal(false);
            setNewProject({ name: '', description: '', status: 'planning' });
            await loadProjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setCreating(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">Loading projects...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage and organize your projects
                    </p>
                </div>
                
                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            + New Project
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Create New Project</DialogTitle>
                            <DialogDescription>
                                Add a new project to your workspace. Fill in the details below.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <form onSubmit={handleCreateProject} className="space-y-4 py-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            
                            <div className="space-y-2">
                                <Label htmlFor="name">Project Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Enter project name"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Enter project description"
                                    value={newProject.description || ''}
                                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={newProject.status}
                                    onValueChange={(value) => setNewProject({ ...newProject, status: value })}
                                >
                                    <SelectTrigger id="status">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planning">Planning</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="on_hold">On Hold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <DialogFooter>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setShowCreateModal(false)}
                                    disabled={creating}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={creating}>
                                    {creating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Project'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {error && !showCreateModal && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Projects Grid */}
            {projects.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Folder className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                            Get started by creating your first project. Click the button above to begin.
                        </p>
                        <Button onClick={() => setShowCreateModal(true)} variant="outline" className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create First Project
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => {
                        const statusConfig = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
                        
                        return (
                            <Card
                                key={project.id}
                                className="project-card cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 group"
                                onClick={() => navigate({ to: `/projects/${project.id}` })}
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                                                {project.name}
                                            </CardTitle>
                                        </div>
                                        <Badge variant={statusConfig.variant} className="shrink-0">
                                            {statusConfig.label}
                                        </Badge>
                                    </div>
                                    <CardDescription className="line-clamp-2 mt-2">
                                        {project.description || 'No description provided'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3 h-3" />
                                        <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
