import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { FolderKanban, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const GlassCard = ({ children, className, selected }: { children: React.ReactNode, className?: string, selected?: boolean }) => (
    <div className={cn(
        "relative rounded-xl border bg-background/60 backdrop-blur-md shadow-sm transition-all duration-300",
        "hover:shadow-md hover:bg-background/80",
        selected ? "border-primary ring-2 ring-primary/20 shadow-lg" : "border-border/40",
        className
    )}>
        {children}
    </div>
);

export const ProjectNode = memo(({ data, selected }: NodeProps) => {
    return (
        <GlassCard selected={selected} className={cn(
            "min-w-[180px] group",
            data.isRoot ? "border-sky-500/50 bg-sky-50/50 dark:bg-sky-950/20" : ""
        )}>
            <Handle type="target" position={Position.Left} className="!bg-sky-500/50" />

            <div className="p-3">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                        data.isRoot ? "bg-sky-500 text-white" : "bg-sky-500/10 text-sky-600"
                    )}>
                        <FolderKanban className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-foreground/90 leading-tight truncate max-w-[100px]">{data.label}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-tight font-mono">Project</div>
                    </div>
                </div>
                <div className="mt-2 flex justify-between items-center">
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted/50 uppercase">{data.status}</span>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!bg-sky-500/50" />
        </GlassCard>
    );
});

export const TaskNode = memo(({ data, selected }: NodeProps) => {
    const StatusIcon = {
        todo: Circle,
        in_progress: Clock,
        done: CheckCircle2,
        blocked: AlertCircle,
    }[data.status as string] || Circle;

    const statusColor = {
        todo: "text-slate-400",
        in_progress: "text-blue-500",
        done: "text-emerald-500",
        blocked: "text-red-500",
    }[data.status as string] || "text-slate-400";

    return (
        <GlassCard selected={selected} className="min-w-[160px] group">
            <Handle type="target" position={Position.Left} className="!bg-slate-400/50" />

            <div className="p-3">
                <div className="flex items-center gap-3">
                    <div className={cn("h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform", statusColor)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold text-foreground/90 leading-tight truncate max-w-[100px]">{data.label}</div>
                        <div className="text-[8px] text-muted-foreground uppercase tracking-wider">Task</div>
                    </div>
                </div>
                <div className="mt-2 flex justify-between items-center border-t border-border/10 pt-2">
                    <span className={cn("text-[8px] font-bold uppercase", statusColor)}>{data.status}</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{data.priority}</span>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!bg-slate-400/50" />
        </GlassCard>
    );
});
