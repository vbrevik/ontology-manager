import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    Terminal,
    Play,
    Save,
    Code2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    FileCode,
    RotateCcw,
    Copy,
    Users,
    Lock,
    Database
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const Route = createFileRoute('/admin/access/policies')({
    component: PoliciesPage,
})

type PolicyTemplate = {
    id: string
    name: string
    description: string
    policy: string
}

type SimulationResult = {
    allowed: boolean
    reason: string
    matchedRules: string[]
    executionTime: number
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
    {
        id: 'empty',
        name: 'Empty Policy',
        description: 'Start with a blank canvas',
        policy: '// Define your ReBAC policy here\n'
    },
    {
        id: 'basic-rbac',
        name: 'Basic RBAC',
        description: 'Simple role-based access control',
        policy: `// Basic RBAC Policy
allow if user.role == "admin"
allow if user.role == "editor" and action in ["read", "update"]
allow if user.role == "viewer" and action == "read"
deny`
    },
    {
        id: 'resource-owner',
        name: 'Resource Ownership',
        description: 'Allow access based on ownership',
        policy: `// Resource Owner Policy
allow if resource.owner_id == user.id
allow if user.role == "admin"
allow if user.id in resource.collaborators and action in ["read", "update"]
deny`
    },
    {
        id: 'hierarchical',
        name: 'Hierarchical Permissions',
        description: 'Parent-child relationship access',
        policy: `// Hierarchical Access Policy
allow if user.department == resource.department
allow if user.role == "manager" and user.department in resource.allowed_departments
allow if resource.public == true and action == "read"
deny`
    },
    {
        id: 'time-based',
        name: 'Time-Based Access',
        description: 'Access with temporal constraints',
        policy: `// Time-Based Access Policy
allow if user.role == "admin"
allow if current_time >= resource.available_from and current_time <= resource.available_until
allow if user.has_subscription and action == "read"
deny`
    }
]

function PoliciesPage() {
    const [policy, setPolicy] = useState(POLICY_TEMPLATES[0].policy)
    const [selectedTemplate, setSelectedTemplate] = useState(POLICY_TEMPLATES[0].id)
    const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
    const [isEvaluating, setIsEvaluating] = useState(false)
    const [saved, setSaved] = useState(false)

    // Simulation input state
    const [subject, setSubject] = useState('{ "id": "user_123", "role": "editor", "department": "engineering" }')
    const [action, setAction] = useState('read')
    const [resource, setResource] = useState('{ "id": "doc_456", "owner_id": "user_789", "department": "engineering" }')

    const handleTemplateChange = (templateId: string) => {
        const template = POLICY_TEMPLATES.find(t => t.id === templateId)
        if (template) {
            setPolicy(template.policy)
            setSelectedTemplate(templateId)
            setSimulationResult(null)
        }
    }

    const handleEvaluate = async () => {
        setIsEvaluating(true)

        // Simulate policy evaluation
        await new Promise(resolve => setTimeout(resolve, 800))

        // Mock evaluation result - in real implementation, this would call backend
        const mockResult: SimulationResult = {
            allowed: Math.random() > 0.5,
            reason: 'Policy evaluation completed',
            matchedRules: ['Rule 1: user.role == "editor"', 'Rule 2: action in ["read", "update"]'],
            executionTime: Math.random() * 50
        }

        setSimulationResult(mockResult)
        setIsEvaluating(false)
    }

    const handleSave = () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(policy)
    }

    const handleReset = () => {
        handleTemplateChange(selectedTemplate)
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-700">
            {/* Left Column: Policy Editor */}
            <div className="lg:col-span-2 space-y-4">
                <Card className="border-border/40 bg-background/40">
                    <CardHeader className="border-b border-border/20 pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Code2 className="h-5 w-5 text-purple-500" />
                                <CardTitle className="text-lg">Policy Editor</CardTitle>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                                    <SelectTrigger className="w-48 h-8 text-xs">
                                        <SelectValue placeholder="Select template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {POLICY_TEMPLATES.map(template => (
                                            <SelectItem key={template.id} value={template.id}>
                                                {template.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="ghost" onClick={handleReset} className="h-8">
                                    <RotateCcw className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCopy} className="h-8">
                                    <Copy className="h-3 w-3" />
                                </Button>
                                <Button size="sm" onClick={handleSave} className={cn(
                                    "h-8 transition-all",
                                    saved && "bg-green-600 hover:bg-green-700"
                                )}>
                                    <Save className="mr-1 h-3 w-3" />
                                    {saved ? 'Saved!' : 'Save'}
                                </Button>
                            </div>
                        </div>
                        <CardDescription className="mt-2">
                            {POLICY_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="relative">
                            <textarea
                                value={policy}
                                onChange={(e) => setPolicy(e.target.value)}
                                className={cn(
                                    "w-full h-[500px] p-6 font-mono text-sm",
                                    "bg-slate-950 text-slate-100",
                                    "focus:outline-none focus:ring-2 focus:ring-purple-500/20",
                                    "resize-none",
                                    "dark:bg-slate-950 dark:text-slate-100"
                                )}
                                placeholder="// Write your policy here..."
                                spellCheck={false}
                            />
                            <div className="absolute bottom-2 right-2 flex items-center space-x-2 text-xs text-slate-400">
                                <FileCode className="h-3 w-3" />
                                <span>{policy.split('\n').length} lines</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Syntax Help */}
                <Card className="border-border/40 bg-purple-500/[0.02]">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center">
                            <Terminal className="mr-2 h-4 w-4 text-purple-500" />
                            Quick Reference
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                                <p className="font-bold text-muted-foreground uppercase tracking-wider">Operators</p>
                                <code className="block bg-muted/50 p-1 rounded">==, !=, in, and, or</code>
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted-foreground uppercase tracking-wider">Keywords</p>
                                <code className="block bg-muted/50 p-1 rounded">allow, deny, if</code>
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted-foreground uppercase tracking-wider">Variables</p>
                                <code className="block bg-muted/50 p-1 rounded">user, resource, action</code>
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted-foreground uppercase tracking-wider">Functions</p>
                                <code className="block bg-muted/50 p-1 rounded">has_role(), is_owner()</code>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Simulation Panel */}
            <div className="space-y-4">
                <Card className="border-border/40 bg-background/40">
                    <CardHeader className="border-b border-border/20 pb-4">
                        <div className="flex items-center space-x-2">
                            <Play className="h-5 w-5 text-indigo-500" />
                            <CardTitle className="text-lg">Simulation</CardTitle>
                        </div>
                        <CardDescription>Test your policy with real scenarios</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {/* Subject Input */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider flex items-center text-muted-foreground">
                                <Users className="mr-2 h-3 w-3" />
                                Subject (User)
                            </Label>
                            <textarea
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full h-24 p-3 text-xs font-mono bg-background border border-border/40 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none"
                                placeholder='{ "id": "..." }'
                            />
                        </div>

                        {/* Action Input */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider flex items-center text-muted-foreground">
                                <Lock className="mr-2 h-3 w-3" />
                                Action
                            </Label>
                            <Input
                                value={action}
                                onChange={(e) => setAction(e.target.value)}
                                className="font-mono text-xs"
                                placeholder="read, write, delete..."
                            />
                        </div>

                        {/* Resource Input */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider flex items-center text-muted-foreground">
                                <Database className="mr-2 h-3 w-3" />
                                Resource (Object)
                            </Label>
                            <textarea
                                value={resource}
                                onChange={(e) => setResource(e.target.value)}
                                className="w-full h-24 p-3 text-xs font-mono bg-background border border-border/40 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none"
                                placeholder='{ "id": "..." }'
                            />
                        </div>

                        <Button
                            onClick={handleEvaluate}
                            disabled={isEvaluating}
                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                        >
                            {isEvaluating ? (
                                <>
                                    <Terminal className="mr-2 h-4 w-4 animate-pulse" />
                                    Evaluating...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Run Evaluation
                                </>
                            )}
                        </Button>

                        {/* Results */}
                        {simulationResult && (
                            <div className="animate-in slide-in-from-top-2 duration-300 space-y-3 pt-4 border-t border-border/40">
                                <Alert className={cn(
                                    "border-2",
                                    simulationResult.allowed
                                        ? "bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400"
                                        : "bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400"
                                )}>
                                    {simulationResult.allowed ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        <XCircle className="h-4 w-4" />
                                    )}
                                    <AlertTitle className="font-bold text-sm">
                                        {simulationResult.allowed ? 'Access Granted' : 'Access Denied'}
                                    </AlertTitle>
                                    <AlertDescription className="text-xs mt-1">
                                        {simulationResult.reason}
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Matched Rules
                                    </p>
                                    <div className="space-y-1">
                                        {simulationResult.matchedRules.map((rule, i) => (
                                            <div key={i} className="text-xs bg-muted/30 p-2 rounded font-mono">
                                                {rule}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                                    <span>Execution time:</span>
                                    <span className="font-mono font-bold">{simulationResult.executionTime.toFixed(2)}ms</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Tips Card */}
                <Card className="border-border/40 bg-indigo-500/[0.02] border-dashed">
                    <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="h-4 w-4 text-indigo-500 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Pro Tip</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Start with a template and modify it to match your use case. Policies are evaluated top-to-bottom.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
