import type { LucideIcon } from "lucide-react"
import { ArrowLeft } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

interface PlaceholderProps {
    title: string
    description: string
    icon: LucideIcon
    color?: string
}

export default function Placeholder({ title, description, icon: Icon, color = "from-primary to-blue-600" }: PlaceholderProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative mb-8">
                <div className={`absolute inset-0 bg-gradient-to-r ${color} rounded-full blur-2xl opacity-20 animate-pulse`} />
                <div className={`relative p-6 rounded-2xl bg-gradient-to-br ${color} text-white shadow-xl`}>
                    <Icon size={48} />
                </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-center">
                {title}
            </h1>

            <p className="text-lg text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
                {description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/">
                    <Button variant="outline" className="gap-2">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Button>
                </Link>
                <Button className="font-semibold">
                    Notify Me When Ready
                </Button>
            </div>

            <div className="mt-16 pt-8 border-t border-border/40 w-full max-w-sm text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Development Status</p>
                <div className="flex items-center justify-center gap-2">
                    <div className="h-2 w-32 bg-muted rounded-full overflow-hidden text-left">
                        <div className={`h-full bg-gradient-to-r ${color} w-1/3 animate-pulse`} />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground italic">Work in Progress</span>
                </div>
            </div>
        </div>
    )
}
