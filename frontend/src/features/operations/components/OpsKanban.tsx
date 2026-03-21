import type { Project } from '@/features/projects/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@tanstack/react-router';

interface OpsKanbanProps {
    projects: Project[];
}

export function OpsKanban({ projects }: OpsKanbanProps) {
    const planning = projects.filter(p => p.status === 'PLANNING' || p.status === 'DRAFT');
    const active = projects.filter(p => p.status === 'ACTIVE');
    const completed = projects.filter(p => p.status === 'COMPLETED' || p.status === 'ARCHIVED');

    return (
        <div className="grid grid-cols-3 gap-6 h-full overflow-hidden">
            <KanbanColumn title="Planning / Init" projects={planning} color="border-t-blue-500" />
            <KanbanColumn title="Active Execution" projects={active} color="border-t-emerald-500" />
            <KanbanColumn title="Completed / Debrief" projects={completed} color="border-t-slate-500" />
        </div>
    );
}

function KanbanColumn({ title, projects, color }: { title: string, projects: Project[], color: string }) {
    return (
        <div className="flex flex-col h-full bg-slate-900/30 rounded-lg border border-slate-800">
            <div className={`p-4 border-b border-slate-800 bg-slate-900 font-medium text-slate-300 border-t-2 ${color}`}>
                <div className="flex justify-between items-center">
                    <span>{title}</span>
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-500">{projects.length}</span>
                </div>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {projects.map(project => (
                    <Link key={project.id} to={`/targeting/ops/${project.id}`} className="block">
                        <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group">
                            <CardHeader className="p-3 pb-1">
                                <CardTitle className="text-sm font-medium text-slate-200 group-hover:text-blue-400">
                                    {project.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-1">
                                <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                                    {project.description || 'No description provided.'}
                                </p>
                                <div className="flex justify-between items-center text-[10px] text-slate-600 font-mono">
                                    <span>{project.id.split('-')[0]}</span>
                                    <span>{project.start_date || 'TBD'}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
