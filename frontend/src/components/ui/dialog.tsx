import * as React from "react"
import { cn } from "@/lib/utils"

const Dialog = ({ children, open }: any) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
                {children}
            </div>
        </div>
    )
}

const DialogContent = ({ children, className }: any) => (
    <div className={cn("p-6", className)}>{children}</div>
)

const DialogHeader = ({ children }: any) => (
    <div className="p-6 pb-2 space-y-1.5">{children}</div>
)

const DialogFooter = ({ children }: any) => (
    <div className="p-6 pt-2 flex justify-end space-x-2 border-t border-border/40 mt-4">{children}</div>
)

const DialogTitle = ({ children }: any) => (
    <h3 className="text-xl font-bold tracking-tight">{children}</h3>
)

const DialogDescription = ({ children }: any) => (
    <p className="text-sm text-muted-foreground">{children}</p>
)

const DialogTrigger = ({ children, asChild, ...props }: any) => {
    return React.cloneElement(children as React.ReactElement, props);
}

export {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
