
import { useRef, useEffect } from 'react';
import { Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NodeContextMenuProps {
    x: number;
    y: number;
    type: string;
    onClose: () => void;
    onDelete: () => void;
    onInspect: () => void;
}

export function NodeContextMenu({ x, y, type, onClose, onDelete, onInspect }: NodeContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className={cn(
                "fixed z-50 w-48 rounded-lg border border-border/40 bg-background/80 backdrop-blur-md shadow-lg p-1",
                "animate-in fade-in zoom-in-95 duration-100"
            )}
            style={{ top: y, left: x }}
        >
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/20 mb-1">
                {type === 'class' ? 'Class Actions' : 'Entity Actions'}
            </div>

            <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 px-2 space-x-2"
                onClick={(e) => { e.stopPropagation(); onInspect(); }}
            >
                <Search className="h-3.5 w-3.5 mr-2" />
                Inspect Details
            </Button>

            <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 px-2 space-x-2 text-red-500 hover:text-red-600 hover:bg-red-100/10"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete Node
            </Button>
        </div>
    );
}
