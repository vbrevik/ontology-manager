import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Shield, Database, FileText, ChevronRight } from 'lucide-react'

export const OnboardingGuide = () => {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState(0)

    useEffect(() => {
        const completed = localStorage.getItem('onboarding_completed')
        if (!completed) {
            // Small delay to not overwhelm on initial load
            const timer = setTimeout(() => setOpen(true), 1000)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleComplete = () => {
        setOpen(false)
        localStorage.setItem('onboarding_completed', 'true')
    }

    const steps = [
        {
            title: "Welcome to Ontology Manager",
            description: "Your centralized platform for managing system ontology, access control, and logs. Let's take a quick tour of what's new.",
            icon: <Database className="w-12 h-12 text-indigo-600 mb-4" />
        },
        {
            title: "Access Control & Policies",
            description: "Define granular ABAC/ReBAC policies with our new Visual Policy Editor and simulate access decisions in real-time.",
            icon: <Shield className="w-12 h-12 text-emerald-600 mb-4" />
        },
        {
            title: "System Logs & Reports",
            description: "Track every action with detailed system logs and export comprehensive audit reports for compliance.",
            icon: <FileText className="w-12 h-12 text-blue-600 mb-4" />
        }
    ]

    const currentStep = steps[step]

    return (
        <Dialog open={open} onOpenChange={(val: boolean) => !val && handleComplete()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex justify-center">{currentStep.icon}</div>
                    <DialogTitle className="text-center text-xl">{currentStep.title}</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        {currentStep.description}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex justify-center gap-1">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 w-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-muted'}`}
                            />
                        ))}
                    </div>
                </div>
                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" onClick={handleComplete}>Skip</Button>
                    <Button onClick={() => {
                        if (step < steps.length - 1) {
                            setStep(step + 1)
                        } else {
                            handleComplete()
                        }
                    }}>
                        {step < steps.length - 1 ? (
                            <>Next <ChevronRight className="ml-2 h-4 w-4" /></>
                        ) : 'Get Started'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
