import type { Project } from '@/features/projects/lib/api';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Link } from '@tanstack/react-router';

interface OpsListProps {
    projects: Project[];
}

export function OpsList({ projects }: OpsListProps) {
    return (
        <div className="rounded-md border border-slate-800 bg-slate-900/50">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-900 text-slate-400 font-medium border-b border-slate-800">
                    <tr>
                        <th className="px-4 py-3">Operation Name</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Commander / Owner</th>
                        <th className="px-4 py-3">Start Date</th>
                        <th className="px-4 py-3">Privacy</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {projects.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                No active operations found.
                            </td>
                        </tr>
                    ) : (
                        projects.map((project) => (
                            <tr key={project.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-200">
                                    <Link to={`/targeting/ops/${project.id}`} className="hover:underline hover:text-blue-400">
                                        {project.name}
                                    </Link>
                                    {project.description && (
                                        <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">
                                            {project.description}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={project.status} />
                                </td>
                                <td className="px-4 py-3 text-slate-400">
                                    {project.owner_id ? 'CMD Unknown' : 'Unassigned'}
                                </td>
                                <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                                    {project.start_date ? format(new Date(project.start_date), 'dd MMM yyyy') : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
                                        {project.tenant_id ? 'TS//SCI' : 'UNCLASS'}
                                    </Badge>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        PLANNING: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        PENDING: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
        COMPLETED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    } as Record<string, string>;

    const fallback = styles.PENDING;

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${styles[status] || fallback}`}>
            {status}
        </span>
    );
}
