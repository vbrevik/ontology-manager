import type { Project } from '@/features/projects/lib/api';

interface OpsMapProps {
    projects: Project[];
}

export function OpsMap({ projects }: OpsMapProps) {
    return (
        <div className="h-[600px] w-full bg-slate-950 border border-slate-800 rounded-lg relative overflow-hidden group">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

            {/* Simulated Map Markers */}
            <div className="absolute top-1/4 left-1/4">
                <MapMarker label="OP ALPHA" color="bg-emerald-500" />
            </div>
            <div className="absolute top-1/2 left-2/3">
                <MapMarker label="OP BRAVO" color="bg-blue-500" />
            </div>

            <div className="absolute top-4 right-4 bg-slate-900/90 p-4 rounded border border-slate-800 backdrop-blur">
                <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Global Situational Awareness</h3>
                <p className="text-xs text-slate-500">
                    Displaying {projects.length} active theaters.
                    <br />
                    <span className="text-red-500 font-mono mt-1 block">LIVE FEED DISCONNECTED</span>
                </p>
            </div>
        </div>
    );
}

function MapMarker({ label, color }: { label: string, color: string }) {
    return (
        <div className="flex flex-col items-center gap-1 group/marker cursor-pointer">
            <div className={`w-3 h-3 rounded-full ${color} animate-pulse ring-4 ring-${color}/20`} />
            <span className="text-[10px] font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800 opacity-60 group-hover/marker:opacity-100 transition-opacity">
                {label}
            </span>
        </div>
    );
}
