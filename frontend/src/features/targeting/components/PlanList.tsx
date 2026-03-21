import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Link } from '@tanstack/react-router';
import { FileTextIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';

// Mock Data for Phase 1 Visualization
const PLANS = [
    {
        id: 'op-alpha-1',
        name: 'OPLAN 24-001 (ALPHA)',
        type: 'OPLAN',
        status: 'ACTIVE',
        commander: 'BG J. Doe',
        phase: 'Phone 3: Execution',
        lastUpdated: '2026-01-23 14:00Z'
    },
    {
        id: 'sup-beta-2',
        name: 'SUPPLAN 24-002 (LOGISTICS)',
        type: 'SUPPLAN',
        status: 'DRAFT',
        commander: 'COL R. Smith',
        phase: 'Phase 2: Plan Dev',
        lastUpdated: '2026-01-22 09:30Z'
    },
    {
        id: 'con-charlie-3',
        name: 'CONPLAN 24-003 (CYBER DEFENSE)',
        type: 'CONPLAN',
        status: 'REVIEW',
        commander: 'LTC M. Jones',
        phase: 'Phase 1: Concept',
        lastUpdated: '2026-01-20 18:45Z'
    }
];

export function PlanList() {
    return (
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50">
            <Table>
                <TableHeader className="bg-slate-900/80">
                    <TableRow className="hover:bg-transparent border-slate-800">
                        <TableHead className="w-[400px] text-slate-400 font-mono text-xs uppercase">Plan Name / ID</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase">Type</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase">Status</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase">Current Phase</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase">Last Updated</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {PLANS.map((plan) => (
                        <TableRow key={plan.id} className="border-slate-800 hover:bg-slate-800/50 group">
                            <TableCell className="font-medium text-slate-200">
                                <Link to="/targeting/planning/$planId" params={{ planId: plan.id }} className="flex items-center gap-3 hover:text-orange-500 transition-colors">
                                    <div className="p-2 rounded bg-slate-800 text-slate-400 group-hover:text-orange-500 group-hover:bg-orange-500/10 transition-colors">
                                        <FileTextIcon />
                                    </div>
                                    <div>
                                        <div className="font-bold">{plan.name}</div>
                                        <div className="text-xs text-slate-500 font-mono">CMD: {plan.commander}</div>
                                    </div>
                                </Link>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="font-mono text-[10px] border-slate-700 text-slate-400">
                                    {plan.type}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={plan.status} />
                            </TableCell>
                            <TableCell className="text-sm text-slate-400 font-mono">
                                {plan.phase}
                            </TableCell>
                            <TableCell className="text-sm text-slate-500 font-mono">
                                {plan.lastUpdated}
                            </TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-200">
                                    <DotsHorizontalIcon />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
        DRAFT: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        REVIEW: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    }[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';

    return (
        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
            {status}
        </span>
    );
}
