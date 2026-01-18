import { useMemo } from 'react';
import type { Task } from '../lib/api';
import { format, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, addDays, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GanttChartProps {
    tasks: Task[];
    startDate?: Date;
    endDate?: Date;
}

export function GanttChart({ tasks, startDate, endDate }: GanttChartProps) {
    const today = startOfToday();

    // Calculate timeline range
    const timelineStart = useMemo(() => {
        if (startDate) return startOfMonth(startDate);
        const taskDates = tasks
            .map(t => t.start_date ? new Date(t.start_date) : null)
            .filter(Boolean) as Date[];
        if (taskDates.length === 0) return startOfMonth(today);
        return startOfMonth(new Date(Math.min(...taskDates.map(d => d.getTime()))));
    }, [tasks, startDate, today]);

    const timelineEnd = useMemo(() => {
        if (endDate) return endOfMonth(endDate);
        const taskDates = tasks
            .map(t => t.due_date ? new Date(t.due_date) : null)
            .filter(Boolean) as Date[];
        if (taskDates.length === 0) return endOfMonth(addDays(timelineStart, 30));
        return endOfMonth(new Date(Math.max(...taskDates.map(d => d.getTime()))));
    }, [tasks, endDate, timelineStart]);

    const days = useMemo(() => eachDayOfInterval({ start: timelineStart, end: timelineEnd }), [timelineStart, timelineEnd]);
    const totalDays = days.length;

    const getTaskStyle = (task: Task) => {
        if (!task.start_date || !task.due_date) return { display: 'none' };

        const start = new Date(task.start_date);
        const end = new Date(task.due_date);

        const left = (differenceInDays(start, timelineStart) / totalDays) * 100;
        const width = ((differenceInDays(end, start) + 1) / totalDays) * 100;

        return {
            left: `${left}%`,
            width: `${width}%`,
        };
    };

    return (
        <TooltipProvider>
            <div className="w-full overflow-x-auto rounded-xl border border-border/40 bg-background/50 backdrop-blur-sm p-6">
                <div className="min-w-[800px]">
                    {/* Timeline Header */}
                    <div className="flex mb-8 border-b border-border/40 pb-4">
                        <div className="w-64 flex-shrink-0 font-bold text-muted-foreground uppercase tracking-wider text-xs">Task Name</div>
                        <div className="flex-1 relative flex">
                            {days.filter(d => d.getDate() === 1 || d.getDate() === 15).map((day, i) => (
                                <div
                                    key={i}
                                    className="absolute text-[10px] text-muted-foreground/60 border-l border-border/20 pl-1 h-4"
                                    style={{ left: `${(differenceInDays(day, timelineStart) / totalDays) * 100}%` }}
                                >
                                    {format(day, 'MMM d')}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Task Rows */}
                    <div className="space-y-4">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex items-center group">
                                <div className="w-64 flex-shrink-0 pr-4">
                                    <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{task.title}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-tight">{task.status}</div>
                                </div>
                                <div className="flex-1 relative h-8 bg-muted/20 rounded-full overflow-hidden">
                                    {task.start_date && task.due_date ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        "absolute h-full rounded-full transition-all duration-500 hover:brightness-125 cursor-pointer shadow-lg shadow-primary/10",
                                                        task.status === 'done' ? "bg-emerald-500" :
                                                            task.status === 'in_progress' ? "bg-blue-500 animate-pulse" :
                                                                task.status === 'blocked' ? "bg-red-500" : "bg-primary/60"
                                                    )}
                                                    style={getTaskStyle(task)}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="p-1">
                                                    <p className="font-bold">{task.title}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(task.start_date), 'MMM d')} - {format(new Date(task.due_date), 'MMM d')}
                                                    </p>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground/40 italic">
                                            No dates set
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {tasks.length === 0 && (
                        <div className="py-20 text-center text-muted-foreground border-2 border-dashed border-border/40 rounded-2xl mx-64">
                            No tasks found for this project
                        </div>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
}
