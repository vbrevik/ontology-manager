import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckIcon } from "@radix-ui/react-icons";

const PHASES = [
    { id: 1, name: "Initiation", desc: "Receipt of Mission" },
    { id: 2, name: "Orientation", desc: "Mission Analysis" },
    { id: 3, name: "Concept Dev", desc: "COA Development" },
    { id: 4, name: "Plan Dev", desc: "Plan/Order Development" },
    { id: 5, name: "Review", desc: "Plan Review & Approval" },
];

export function CopdPhases({ currentPhase }: { currentPhase: number }) {
    return (
        <div className="w-full flex items-center justify-between px-4">
            {PHASES.map((phase, index) => {
                const isComplete = phase.id < currentPhase;
                const isCurrent = phase.id === currentPhase;
                const isPending = phase.id > currentPhase;

                return (
                    <div key={phase.id} className="flex flex-col items-center relative flex-1 group">
                        {/* Connector Line */}
                        {index !== 0 && (
                            <div
                                className={`absolute top-3 right-[50%] w-full h-[2px] -z-10 
                  ${isComplete ? 'bg-emerald-500/20' : 'bg-slate-800'}
                `}
                            />
                        )}

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300
                    ${isComplete ? 'bg-emerald-500 text-slate-950 border-emerald-500' : ''}
                    ${isCurrent ? 'bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-110' : ''}
                    ${isPending ? 'bg-slate-900 text-slate-600 border-slate-700' : ''}
                  `}>
                                        {isComplete ? <CheckIcon className="w-4 h-4" /> : phase.id}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 border-slate-700 text-slate-200">
                                    <p className="font-bold">{phase.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <span className={`
              mt-2 text-[10px] uppercase font-mono tracking-wider transition-colors
              ${isCurrent ? 'text-orange-500 font-bold' : ''}
              ${isComplete ? 'text-emerald-500' : ''}
              ${isPending ? 'text-slate-600' : ''}
            `}>
                            {phase.name}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
