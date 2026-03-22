import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listProjects } from '@/features/projects/lib/api';
import { ViewSwitcher } from './ViewSwitcher';
import type { ViewMode } from './ViewSwitcher';
import { OpsList } from './OpsList';
import { OpsKanban } from './OpsKanban';
import { OpsMap } from './OpsMap';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@radix-ui/react-icons';
import { Separator } from '@/components/ui/separator';

export function OpsDashboard() {
    const [view, setView] = useState<ViewMode>('list');

    const { data, isLoading, isError } = useQuery({
        queryKey: ['projects'],
        queryFn: () => listProjects(),
    });

    const projects = data?.projects || [];

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200">
            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 backdrop-blur sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold tracking-tight uppercase">Current Operations (J3)</h1>
                    <Separator orientation="vertical" className="h-6 bg-slate-800" />
                    <div className="text-xs text-slate-500 font-mono">
                        {projects.length} ACTIVE THEATERS
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <ViewSwitcher currentView={view} onViewChange={setView} />
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
                        <PlusIcon className="w-4 h-4 mr-2" />
                        New Op
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-auto">
                {isLoading ? (
                    <div className="text-center p-12 text-slate-500">Loading operations...</div>
                ) : isError ? (
                    <div className="text-center p-12 text-red-500">Failed to load operations. System Offline.</div>
                ) : (
                    <>
                        {view === 'list' && <OpsList projects={projects} />}
                        {view === 'kanban' && <OpsKanban projects={projects} />}
                        {view === 'map' && <OpsMap projects={projects} />}
                    </>
                )}
            </div>
        </div>
    );
}
