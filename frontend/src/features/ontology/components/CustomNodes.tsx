
import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Database, FolderTree } from 'lucide-react';
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

export const EntityNode = memo(({ data, selected }: NodeProps) => {
    const approvalStatus = data.approval_status || 'PENDING';
    const attributeCount = data.details ? Object.keys(data.details).length : 0;

    const statusColors = {
        APPROVED: 'bg-green-500/90 text-white',
        PENDING: 'bg-yellow-500/90 text-white',
        REJECTED: 'bg-red-500/90 text-white',
    };

    return (
        <GlassCard selected={selected} className={cn(
            "min-w-[172px] group relative",
            selected && "animate-pulse-subtle"
        )}>
            <Handle type="target" position={Position.Top} className="!bg-primary/50 !w-3 !h-1 !rounded-full !-top-1.5" />

            {/* Status Badge */}
            <div className={cn(
                "absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[8px] font-bold shadow-md z-10",
                statusColors[approvalStatus as keyof typeof statusColors] || statusColors.PENDING
            )}>
                {approvalStatus}
            </div>

            <div className="p-3">
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Database className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs font-bold text-foreground/90 leading-tight">{data.label}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">Entity</div>
                    </div>
                    {/* Attribute Count Badge */}
                    {attributeCount > 0 && (
                        <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-blue-600">{attributeCount}</span>
                        </div>
                    )}
                </div>

                {data.details && (
                    <div className="pt-2 border-t border-border/20 space-y-1">
                        {Object.entries(data.details).slice(0, 2).map(([k, v]) => (
                            <div key={k} className="flex justify-between text-[9px]">
                                <span className="text-muted-foreground truncate max-w-[60px]">{k}</span>
                                <span className="font-medium truncate max-w-[80px]">{String(v)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Hover Preview - shows when hovering */}
                {data.details && Object.keys(data.details).length > 2 && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-2 p-2 bg-background/95 backdrop-blur-md border border-border/40 rounded-lg shadow-lg z-50 text-[9px] max-w-[200px]">
                        <div className="font-semibold mb-1 text-foreground/80">All Attributes</div>
                        {Object.entries(data.details).slice(0, 5).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2 text-muted-foreground">
                                <span className="truncate">{k}:</span>
                                <span className="truncate font-medium">{String(v)}</span>
                            </div>
                        ))}
                        {Object.keys(data.details).length > 5 && (
                            <div className="text-center mt-1 text-primary">+{Object.keys(data.details).length - 5} more</div>
                        )}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-primary/50 !w-3 !h-1 !rounded-full !-bottom-1.5" />
        </GlassCard>
    );
});

export const ClassNode = memo(({ data, selected }: NodeProps) => {
    return (
        <GlassCard selected={selected} className={cn(
            "min-w-[172px] !bg-orange-50/50 dark:!bg-orange-950/10 border-orange-200/50 dark:border-orange-800/30 group",
            selected && "animate-pulse-subtle"
        )}>
            <Handle type="target" position={Position.Top} className="!bg-orange-500/50 !w-3 !h-1 !rounded-full !-top-1.5" />

            <div className="p-3">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                        <Box className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-foreground/90 leading-tight">{data.label}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">Class</div>
                    </div>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-orange-500/50 !w-3 !h-1 !rounded-full !-bottom-1.5" />
        </GlassCard>
    );
});

export const ContextNode = memo(({ data, selected }: NodeProps) => {
    return (
        <GlassCard selected={selected} className={cn(
            "min-w-[200px] !bg-blue-50/60 dark:!bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30 group",
            selected && "animate-pulse-subtle"
        )}>
            <Handle type="target" position={Position.Top} className="!opacity-0" />

            <div className="p-4 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                    <FolderTree className="h-5 w-5" />
                </div>
                <div className="text-sm font-bold text-blue-900 dark:text-blue-100">{data.label}</div>
                <div className="text-[10px] text-blue-600/80 dark:text-blue-300">Root Context</div>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-blue-500/50 !w-16 !h-1.5 !rounded-full !-bottom-1.5" />
        </GlassCard>
    );
});
