import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@radix-ui/react-icons';
import { PlanList } from '@/features/targeting/components/PlanList';

export const Route = createFileRoute('/targeting/planning/')({
    component: PlanningDashboard,
});

function PlanningDashboard() {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-3">
                        <span className="w-2 h-8 bg-orange-500 rounded-sm inline-block"></span>
                        Operation Plans (J5)
                    </h2>
                    <p className="text-slate-500 mt-2 pl-5">Manage strategic orders, OPLANs, and contingency plans.</p>
                </div>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white font-mono text-xs uppercase tracking-wider">
                    <PlusIcon className="mr-2 w-4 h-4" /> Initialize New Plan
                </Button>
            </div>

            <PlanList />
        </div>
    );
}
