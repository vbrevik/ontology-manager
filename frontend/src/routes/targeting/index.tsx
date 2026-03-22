import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityLogIcon, TargetIcon, LayersIcon } from '@radix-ui/react-icons';
import { useTargetingMetrics } from '@/features/targeting/hooks/useTargetingMetrics';

export const Route = createFileRoute('/targeting/')({
    component: TargetingDashboard,
});

function TargetingDashboard() {
    const { activeOps, pendingOps, totalTargets, isLoading, isError } = useTargetingMetrics();

    if (isLoading) {
        return <div className="p-8 text-slate-500">Loading telemetry...</div>;
    }

    if (isError) {
        return <div className="p-8 text-red-500">System Offline: Unable to fetch metrics.</div>;
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-end justify-between border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-100 uppercase tracking-tight">HQ Dashboard</h2>
                    <p className="text-slate-500 mt-1">Operational Overview & Status</p>
                </div>
                <div className="flex gap-4">
                    <StatusCard label="Active Ops" value={activeOps.toString()} color="text-emerald-500" />
                    <StatusCard label="Pending Approval" value={pendingOps.toString()} color="text-orange-500" />
                    <StatusCard label="High Priority Targets" value={totalTargets.toString()} color="text-red-500" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Operational Tempo"
                    icon={<ActivityLogIcon className="w-5 h-5 text-neutral-400" />}
                    value={activeOps > 0 ? "High" : "Low"}
                    trend={activeOps > 5 ? "+ Elevated" : "Normal"}
                />
                <MetricCard
                    title="Total Entities"
                    icon={<TargetIcon className="w-5 h-5 text-neutral-400" />}
                    value={totalTargets.toString()}
                    trend="In Data Lake"
                />
                <MetricCard
                    title="Active Plans"
                    icon={<LayersIcon className="w-5 h-5 text-neutral-400" />}
                    value={activeOps.toString()}
                    trend="In Execution"
                />
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-500 font-mono text-sm">
        // LIVE MAP FEED - DISCONNECTED
                <br />
                <span className="text-xs opacity-50">Secure connection required for real-time telemetry</span>
            </div>
        </div>
    );
}

function StatusCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="flex flex-col items-end">
            <span className={`text-2xl font-bold ${color}`}>{value}</span>
            <span className="text-xs text-slate-500 uppercase font-mono">{label}</span>
        </div>
    );
}

function MetricCard({ title, icon, value, trend }: { title: string; icon: React.ReactNode; value: string; trend: string }) {
    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-100">{value}</div>
                <p className="text-xs text-slate-500 mt-1 border-t border-slate-800 pt-2">{trend}</p>
            </CardContent>
        </Card>
    );
}
