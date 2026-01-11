import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Shield, Sparkles, Plus, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { abacApi } from '@/features/abac/lib/api'

export const Route = createFileRoute('/admin/roles/designer')({
    component: RoleDesigner,
})

type SuggestedRole = {
    name: string
    description: string
    permissions: string[]
}

function RoleDesigner() {
    const navigate = useNavigate();
    const [context, setContext] = useState('')
    const [suggestions, setSuggestions] = useState<SuggestedRole[]>([])
    const [loading, setLoading] = useState(false)
    const [addingIds, setAddingIds] = useState<Record<number, boolean>>({})
    const [addedIds, setAddedIds] = useState<Record<number, boolean>>({})
    const [error, setError] = useState<string | null>(null)

    const handleSuggest = async () => {
        if (!context.trim()) return
        setLoading(true)
        setError(null)
        setAddedIds({})
        try {
            const res = await fetch('/api/ai/suggest-roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context }),
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Failed to get suggestions')
            const data = await res.json()
            setSuggestions(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleAddRole = async (role: SuggestedRole, index: number) => {
        setAddingIds(prev => ({ ...prev, [index]: true }))
        setError(null)
        try {
            // 1. Create the role
            const newRole = await abacApi.createRole(role.name, role.description)

            // 2. Add each permission
            for (const permission of role.permissions) {
                await abacApi.addPermission(newRole.id, permission)
            }

            setAddedIds(prev => ({ ...prev, [index]: true }))
        } catch (err: any) {
            setError(err.message)
        } finally {
            setAddingIds(prev => ({ ...prev, [index]: false }))
        }
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Role Designer</h1>
                    <p className="text-muted-foreground">
                        Create and define role permissions and attributes using AI assistance.
                    </p>
                </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <CardTitle>AI Role Suggested</CardTitle>
                    </div>
                    <CardDescription>Describe your application domain to get role recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g. A healthcare platform for clinics and patients..."
                            value={context}
                            onChange={e => setContext(e.target.value)}
                            className="bg-background"
                        />
                        <Button onClick={handleSuggest} disabled={loading || !context.trim()} className="gap-2">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Suggest
                        </Button>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {suggestions.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2 mt-4 animate-in fade-in slide-in-from-top-4">
                            {suggestions.map((role, i) => (
                                <Card key={i} className="bg-background relative group">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-sm font-bold">{role.name}</CardTitle>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleAddRole(role, i)}
                                                disabled={addingIds[i] || addedIds[i]}
                                            >
                                                {addingIds[i] ? <Loader2 className="h-4 w-4 animate-spin" /> : addedIds[i] ? <Check className="h-4 w-4 text-green-500" /> : <Plus className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <CardDescription className="text-xs">{role.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-1">
                                            {role.permissions.map((p, j) => (
                                                <span key={j} className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <Check className="h-2 w-2 text-primary" />
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate({ to: '/admin/abac' })}>
                    <CardHeader>
                        <Shield className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Attribute Rules</CardTitle>
                        <CardDescription>Manage attribute-based permissions</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        Define dynamic access controls based on user and resource properties.
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate({ to: '/admin/access/policies' })}>
                    <CardHeader>
                        <Shield className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Relationship Rules</CardTitle>
                        <CardDescription>Manage relationship-based policies</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        Define access patterns based on entity hierarchies and connections.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
