import { useState, useEffect } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { getProject, getProjectTasks, listSubProjects, createProject, type Project, type Task, type CreateProjectInput } from '../lib/api';
import { GanttChart } from './GanttChart';
import { DigitalTwinViewer } from './DigitalTwinViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, LayoutList, Share2, FolderKanban, Plus, ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export function ProjectDetail() {
    const { projectId } = useParams({ from: '/projects/$projectId' });
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [subProjects, setSubProjects] = useState<Project[]>([]);
    const [dependencies, setDependencies] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateSubProjectOpen, setIsCreateSubProjectOpen] = useState(false);
    const [newSubProject, setNewSubProject] = useState<CreateProjectInput>({
        name: '',
        description: '',
        status: 'planning',
    });
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (projectId) {
            loadProjectData();
        }
    }, [projectId]);

    async function loadProjectData() {
        try {
            setLoading(true);
            const [p, t, s] = await Promise.all([
                getProject(projectId),
                getProjectTasks(projectId),
                listSubProjects(projectId)
            ]);
            setProject(p);
            setTasks(t.tasks);
            setSubProjects(s.projects);

            // Fetch dependencies for all tasks
            if (t.tasks.length > 0) {
                const depResults = await Promise.all(
                    t.tasks.map(task =>
                        import('../lib/api').then(api => api.getTaskDependencies(projectId, task.id))
                            .catch(() => ({ dependencies: [] }))
                    )
                );
                const depMap: Record<string, string[]> = {};
                t.tasks.forEach((task, i) => {
                    depMap[task.id] = depResults[i].dependencies;
                });
                setDependencies(depMap);
            }

            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load project');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateSubProject(e: React.FormEvent) {
        e.preventDefault();
        try {
            setIsSaving(true);
            await createProject({
                ...newSubProject,
                parent_project_id: projectId
            });
            setIsCreateSubProjectOpen(false);
            setNewSubProject({ name: '', description: '', status: 'planning' });
            toast({
                title: "Success",
                description: "Sub-project created successfully",
            });
            loadProjectData();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Error",
                description: err instanceof Error ? err.message : 'Failed to create sub-project',
            });
        } finally {
            setIsSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading project details...</div>;
    if (error || !project) return <div className="p-8 text-center text-destructive">Error: {error || 'Project not found'}</div>;

    return (
        <div className="p-6 md:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Breadcrumbs & Navigation */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/projects">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Projects
                    </Link>
                </Button>
                <div className="flex gap-2">
                    {project.permissions?.includes('project.create') && (
                        <Button variant="outline" size="sm" onClick={() => setIsCreateSubProjectOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Sub-project
                        </Button>
                    )}
                    {project.permissions?.includes('task.create') && (
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Task
                        </Button>
                    )}
                </div>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">
                            {project.status.toUpperCase()}
                        </Badge>
                        {project.parent_project_id && (
                            <Badge variant="secondary" className="px-3 py-1">Sub-project</Badge>
                        )}
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent italic">
                        {project.name}
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl">{project.description || 'No description provided'}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border/40 shadow-sm">
                    <div className="flex flex-col items-center px-4 border-r border-border/40">
                        <span className="font-bold text-foreground text-xl">{tasks.length}</span>
                        <span className="text-[10px] uppercase tracking-widest font-medium">Tasks</span>
                    </div>
                    <div className="flex flex-col items-center px-4 border-r border-border/40">
                        <span className="font-bold text-foreground text-xl">{subProjects.length}</span>
                        <span className="text-[10px] uppercase tracking-widest font-medium">Sub-projects</span>
                    </div>
                    <div className="flex flex-col items-center px-4">
                        <Calendar className="h-4 w-4 mb-1" />
                        <span className="text-[10px] uppercase tracking-widest font-medium">
                            {project.start_date ? format(new Date(project.start_date), 'MMM yy') : 'No Date'}
                        </span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-8">
                <TabsList className="bg-background/50 backdrop-blur-sm border border-border/40 p-1 h-auto rounded-xl inline-flex">
                    <TabsTrigger value="overview" className="rounded-lg py-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <LayoutList className="h-4 w-4 mr-2" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="gantt" className="rounded-lg py-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        Timeline (Gantt)
                    </TabsTrigger>
                    <TabsTrigger value="digital-twin" className="rounded-lg py-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Share2 className="h-4 w-4 mr-2" />
                        Digital Twin
                    </TabsTrigger>
                    <TabsTrigger value="sub-projects" className="rounded-lg py-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <FolderKanban className="h-4 w-4 mr-2" />
                        Sub-projects
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-2 border-border/40 bg-background/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Project Tasks</CardTitle>
                                <CardDescription>Manage and track progress of individual work items</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {tasks.map(task => (
                                        <div key={task.id} className="flex items-center justify-between p-4 rounded-xl border border-border/20 bg-muted/10 hover:bg-muted/20 transition-colors">
                                            <div className="space-y-1">
                                                <div className="font-medium">{task.title}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-md">{task.description}</div>
                                            </div>
                                            <Badge variant={task.status === 'done' ? 'default' : 'secondary'}>
                                                {task.status}
                                            </Badge>
                                        </div>
                                    ))}
                                    {tasks.length === 0 && <p className="text-center py-10 text-muted-foreground italic">No tasks found</p>}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold">Metadata</CardTitle>
                                <CardDescription>Key project information</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm">
                                <div className="flex justify-between py-2 border-b border-border/20">
                                    <span className="text-muted-foreground">Tenant ID</span>
                                    <span className="font-mono text-[10px]">{project.tenant_id || 'Global'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-border/20">
                                    <span className="text-muted-foreground">Owner</span>
                                    <span className="font-medium italic">{project.owner_id ? 'Assigned' : 'System'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-border/20">
                                    <span className="text-muted-foreground">ID</span>
                                    <span className="font-mono text-[10px]">{project.id}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="gantt">
                    <GanttChart tasks={tasks} />
                </TabsContent>

                <TabsContent value="digital-twin">
                    <DigitalTwinViewer
                        project={project}
                        tasks={tasks}
                        subProjects={subProjects}
                        dependencies={dependencies}
                    />
                </TabsContent>

                <TabsContent value="sub-projects">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subProjects.map(sub => (
                            <Link key={sub.id} to="/projects/$projectId" params={{ projectId: sub.id }}>
                                <Card className="border-border/40 bg-background/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 group">
                                    <CardHeader>
                                        <CardTitle className="text-lg group-hover:text-primary transition-colors italic">{sub.name}</CardTitle>
                                        <CardDescription className="line-clamp-2">{sub.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge variant="secondary">{sub.status}</Badge>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                        {subProjects.length === 0 && (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-border/40 rounded-2xl text-muted-foreground">
                                No sub-projects found
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
            {/* Create Sub-project Dialog */}
            <Dialog open={isCreateSubProjectOpen} onOpenChange={setIsCreateSubProjectOpen}>
                <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold italic">Create Sub-project</DialogTitle>
                        <DialogDescription>
                            Add a new project nested under <span className="font-semibold text-foreground">{project.name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubProject} className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="sub-name" className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Project Name</Label>
                            <Input
                                id="sub-name"
                                value={newSubProject.name}
                                onChange={(e) => setNewSubProject({ ...newSubProject, name: e.target.value })}
                                placeholder="e.g. Phase 2 Implementation"
                                className="bg-background/50"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sub-desc" className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Description</Label>
                            <Textarea
                                id="sub-desc"
                                value={newSubProject.description || ''}
                                onChange={(e) => setNewSubProject({ ...newSubProject, description: e.target.value })}
                                placeholder="What is this sub-project about?"
                                className="bg-background/50 min-h-[100px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Initial Status</Label>
                            <Select
                                value={newSubProject.status}
                                onValueChange={(val) => setNewSubProject({ ...newSubProject, status: val })}
                            >
                                <SelectTrigger className="bg-background/50">
                                    <SelectValue placeholder="Select status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="planning">Planning</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsCreateSubProjectOpen(false)}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving} className="bg-primary shadow-lg shadow-primary/20">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Create Sub-project
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
