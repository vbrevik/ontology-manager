import { useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    MarkerType,
    type Node,
    type Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getLayoutedElements } from '@/features/ontology/lib/graphUtils';
import { ProjectNode, TaskNode } from './DigitalTwinNodes';
import type { Project, Task } from '../lib/api';

const nodeTypes = {
    project: ProjectNode,
    task: TaskNode,
};

interface DigitalTwinViewerProps {
    project: Project;
    tasks: Task[];
    subProjects: Project[];
    dependencies: Record<string, string[]>;
}

export function DigitalTwinViewer({ project, tasks, subProjects, dependencies }: DigitalTwinViewerProps) {
    const { nodes, edges } = useMemo(() => {
        const rawNodes: Node[] = [];
        const rawEdges: Edge[] = [];

        // 1. Root Project Node
        rawNodes.push({
            id: project.id,
            type: 'project',
            data: {
                label: project.name,
                status: project.status,
                isRoot: true
            },
            position: { x: 0, y: 0 },
        });

        // 2. Sub-projects
        subProjects.forEach(sub => {
            rawNodes.push({
                id: sub.id,
                type: 'project',
                data: {
                    label: sub.name,
                    status: sub.status,
                    isRoot: false
                },
                position: { x: 0, y: 0 },
            });

            rawEdges.push({
                id: `sub-${project.id}-${sub.id}`,
                source: project.id,
                target: sub.id,
                label: 'sub-project',
                animated: true,
                style: { stroke: '#0ea5e9', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
            });
        });

        // 3. Tasks
        tasks.forEach(task => {
            rawNodes.push({
                id: task.id,
                type: 'task',
                data: {
                    label: task.title,
                    status: task.status,
                    priority: task.priority
                },
                position: { x: 0, y: 0 },
            });

            // Connect task to its project
            rawEdges.push({
                id: `task-belongs-${task.id}`,
                source: project.id,
                target: task.id,
                label: 'contains',
                style: { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5,5' },
            });

            // 4. Dependencies
            const taskDeps = dependencies[task.id] || [];
            taskDeps.forEach(depId => {
                rawEdges.push({
                    id: `dep-${depId}-${task.id}`,
                    source: depId,
                    target: task.id,
                    label: 'depends on',
                    style: { stroke: '#ef4444', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
                });
            });
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges, 'LR');
        return { nodes: layoutedNodes, edges: layoutedEdges };
    }, [project, tasks, subProjects, dependencies]);

    return (
        <div className="h-[600px] w-full border border-border/40 rounded-2xl bg-background/50 backdrop-blur-sm shadow-inner relative overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                className="bg-dot-pattern"
            >
                <Background gap={20} size={1} color="#cbd5e1" className="opacity-20" />
                <Controls className="bg-background/80 backdrop-blur border border-border/40" />
                <MiniMap
                    nodeColor={(node) => {
                        if (node.type === 'project') return '#0ea5e9';
                        if (node.type === 'task') return '#94a3b8';
                        return '#eee';
                    }}
                    className="bg-background/80 backdrop-blur border border-border/40"
                />
            </ReactFlow>

            <div className="absolute top-4 right-4 z-10 flex gap-4 bg-background/80 backdrop-blur p-2 rounded-lg border border-border/40 shadow-sm text-[10px] uppercase tracking-widest font-bold">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Project</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>Task</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Dependency</span>
                </div>
            </div>
        </div>
    );
}
