import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    FileTextIcon,
    MagicWandIcon,
    EyeOpenIcon,
    Share1Icon
} from "@radix-ui/react-icons";
import { CopdPhases } from "./CopdPhases";

// Mock data
const PLAN_CONTENT = `# OPERATION ALPHA
## 1. SITUATION
Enemy forces have established defensive positions along the northern ridge. Intelligence indicates reinforced bunkers and AAA batteries.

## 2. MISSION
Joint Task Force ALPHA will assault and seize OBJ BRAVO NLT 240600Z JAN 26 in order to allow follow-on forces to conduct stability operations.

## 3. EXECUTION
a. Concept of Operations
   Phase 1: Shaping Fires
   Phase 2: Ground Assault
   Phase 3: Stabilization

b. Tasks to Maneuver Units
   1-1 Cav: Screen northern flank
   2-3 Inf: Main effort, seize OBJ BRAVO
`;

export function PlanEditor({ planId }: { planId: string }) {
    console.log("Loading Plan:", planId);
    return (
        <div className="flex flex-col h-full w-full flex-1 bg-slate-950">
            {/* Plan Header */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-orange-600/20 text-orange-500 rounded">
                        <FileTextIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-tight">OPLAN 24-001 (ALPHA)</h2>
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-[10px]">ACTIVE</Badge>
                        </div>
                        <div className="text-xs text-slate-500 font-mono flex gap-4">
                            <span>CREATED: 2026-01-20</span>
                            <span>CLASSIFICATION: SECRET//NOFORN</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800 text-slate-300">
                        <Share1Icon className="mr-2 w-3 h-3" /> Share
                    </Button>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                        <EyeOpenIcon className="mr-2 w-3 h-3" /> Visualize Graph
                    </Button>
                </div>
            </div>

            {/* Phase Tracker */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50">
                <CopdPhases currentPhase={3} />
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal">

                    {/* LEFT: Document Editor */}
                    <ResizablePanel defaultSize={60} minSize={30}>
                        <div className="h-full flex flex-col">
                            <div className="h-10 border-b border-slate-800 flex items-center px-4 gap-2 bg-slate-900/30 text-xs text-slate-400">
                                <span className="font-bold text-slate-200">PLAN DOCUMENT</span>
                                <span className="text-slate-600">|</span>
                                <span>Markdown Mode</span>
                            </div>
                            <ScrollArea className="flex-1 p-8 bg-slate-950">
                                <textarea
                                    className="w-full h-[calc(100vh-300px)] bg-transparent border-none outline-none text-slate-300 font-mono text-sm resize-none leading-relaxed"
                                    defaultValue={PLAN_CONTENT}
                                />
                            </ScrollArea>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle className="w-px bg-slate-800" />

                    {/* RIGHT: Ontology Assistant */}
                    <ResizablePanel defaultSize={40} minSize={20}>
                        <div className="h-full flex flex-col bg-slate-900/20 border-l border-slate-800">
                            <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/30">
                                <span className="text-xs font-bold text-orange-500 flex items-center gap-2">
                                    <MagicWandIcon /> ONTOLOGY DETECTED
                                </span>
                                <Badge variant="secondary" className="text-[10px]">5 Entities</Badge>
                            </div>

                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-4">
                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Units (Friendly)</div>
                                    <EntityCard name="Joint Task Force ALPHA" type="Unit" confidence={98} />
                                    <EntityCard name="1-1 Cav" type="Unit" confidence={95} />
                                    <EntityCard name="2-3 Inf" type="Unit" confidence={95} />

                                    <Separator className="bg-slate-800" />

                                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Locations</div>
                                    <EntityCard name="Northern Ridge" type="TerrainFeature" confidence={82} />
                                    <EntityCard name="OBJ BRAVO" type="Objective" confidence={99} />
                                </div>
                            </ScrollArea>
                        </div>
                    </ResizablePanel>

                </ResizablePanelGroup>
            </div>
        </div>
    );
}

function EntityCard({ name, type, confidence }: { name: string; type: string; confidence: number }) {
    return (
        <div className="p-3 bg-slate-900/50 border border-slate-800 rounded hover:border-orange-500/50 cursor-pointer transition-all group">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-200 group-hover:text-orange-400">{name}</span>
                <span className="text-[10px] text-slate-500">{type}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${confidence}%` }} />
                </div>
                <span className="text-[10px] text-emerald-500 font-mono">{confidence}%</span>
            </div>
        </div>
    );
}
