
import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from 'reactflow';
import { cn } from '@/lib/utils';

export const AnimatedEdge = memo((props: EdgeProps) => {
    const {
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        style = {},
        markerEnd,
        label,
    } = props;

    // Determine edge type and styling based on id or data
    const isStructural = props.id?.startsWith('struct-');
    const isSemanticRelationship = props.id?.startsWith('rel-');

    // Variable stroke width based on edge type
    const strokeWidth = isStructural ? '2.5px' : isSemanticRelationship ? '2px' : '1.5px';
    const animationDuration = isStructural ? '3s' : '2s'; // Slower for structural, faster for semantic
    const particleSize = isStructural ? '4' : '3';

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth,
                    transition: 'all 0.3s ease',
                }}
            />
            {/* Animated particle */}
            <circle
                r={particleSize}
                fill={isStructural ? '#0284c7' : '#f97316'}
                className="opacity-80"
            >
                <animateMotion
                    dur={animationDuration}
                    repeatCount="indefinite"
                    path={edgePath}
                />
            </circle>
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan"
                    >
                        <div className={cn(
                            "px-2 py-1 rounded-md border shadow-md text-[10px] font-semibold transition-all",
                            "hover:scale-110 cursor-pointer",
                            isStructural
                                ? "bg-blue-50/90 dark:bg-blue-950/90 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 backdrop-blur-sm"
                                : "bg-orange-50/90 dark:bg-orange-950/90 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 backdrop-blur-sm"
                        )}>
                            {label}
                        </div>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
});
