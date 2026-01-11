
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Building2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useOntologyContext, type ContextEntity } from "@/features/context/context-provider";

import { fetchEntities } from "@/features/ontology/lib/api";

async function fetchAvailableContexts(): Promise<ContextEntity[]> {
    try {
        const entities = await fetchEntities({ is_root: true });
        return entities.map(e => ({
            id: e.id,
            name: e.display_name,
            type: e.class_name
        }));
    } catch (error) {
        console.error("Failed to fetch contexts:", error);
        return [];
    }
}

import { ContextCreationDialog } from "@/components/ContextCreationDialog";
import { PlusCircle } from "lucide-react";

export function ContextSwitcher({ className }: { className?: string }) {
    const { currentContext, setContext } = useOntologyContext();
    const [open, setOpen] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [contexts, setContexts] = useState<ContextEntity[]>([]);

    useEffect(() => {
        loadContexts();
    }, []);

    function loadContexts() {
        fetchAvailableContexts().then(setContexts);
    }

    return (
        <>
            <ContextCreationDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onContextCreated={loadContexts}
            />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("w-[250px] justify-between", className)}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {currentContext ? (
                                <>
                                    <Building2 className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <span className="truncate flex-1 text-left">{currentContext.name}</span>
                                </>
                            ) : (
                                <>
                                    <Globe className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <span>Global Context</span>
                                </>
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0">
                    <Command>
                        <CommandInput placeholder="Search context..." />
                        <CommandList>
                            <CommandEmpty>No context found.</CommandEmpty>
                            <CommandGroup heading="Global">
                                <CommandItem
                                    onSelect={() => {
                                        setContext(null); // Clear context = Global
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Globe className="mr-2 h-4 w-4" />
                                    <span>Global View</span>
                                    {!currentContext && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup heading="Operational Contexts">
                                {contexts.map((ctx) => (
                                    <CommandItem
                                        key={ctx.id}
                                        onSelect={() => {
                                            setContext(ctx);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Building2 className="mr-2 h-4 w-4" />
                                        <div className="flex flex-col">
                                            <span>{ctx.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{ctx.type}</span>
                                        </div>
                                        {currentContext?.id === ctx.id && (
                                            <Check className="ml-auto h-4 w-4" />
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => {
                                        setOpen(false);
                                        setShowCreateDialog(true);
                                    }}
                                    className="cursor-pointer text-blue-500"
                                >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    <span>Create Context</span>
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </>
    );
}
