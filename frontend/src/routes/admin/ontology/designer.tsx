import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Database, Sparkles, History, Loader2, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import * as ontologyApi from '@/features/ontology/lib/api'

export const Route = createFileRoute('/admin/ontology/designer')({
    component: OntologyDesigner,
})

type SuggestedClass = {
    name: string
    description: string
    properties: { name: string; type: string }[]
}

function OntologyDesigner() {
    const [domain, setDomain] = useState('')
    const [suggestions, setSuggestions] = useState<SuggestedClass[]>([])
    const [loading, setLoading] = useState(false)
    const [addingIds, setAddingIds] = useState<Record<number, boolean>>({})
    const [addedIds, setAddedIds] = useState<Record<number, boolean>>({})
    const [error, setError] = useState<string | null>(null)

    const handleSuggest = async () => {
        if (!domain.trim()) return
        setLoading(true)
        setError(null)
        setAddedIds({})
        try {
            const res = await fetch('/api/ai/suggest-ontology', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: domain }),
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

    const handleAddClass = async (cls: SuggestedClass, index: number) => {
        setAddingIds(prev => ({ ...prev, [index]: true }))
        setError(null)
        try {
            // 1. Get current version
            const version = await ontologyApi.fetchCurrentVersion()

            // 2. Create the class
            const newClass = await ontologyApi.createClass({
                name: cls.name,
                description: cls.description,
                version_id: version.id,
                is_abstract: false
            })

            // 3. Add each property
            for (const prop of cls.properties) {
                await ontologyApi.createProperty({
                    name: prop.name,
                    class_id: newClass.id,
                    data_type: prop.type,
                    version_id: version.id,
                    is_required: false,
                    is_unique: false
                })
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
                    <h1 className="text-3xl font-bold tracking-tight">Ontology Designer</h1>
                    <p className="text-muted-foreground">
                        Design schema versions, classes, properties, and relationships.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <History className="h-4 w-4" />
                        Versions
                    </Button>
                </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <CardTitle>AI Ontology Designer</CardTitle>
                    </div>
                    <CardDescription>Describe your domain to get ontology class recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g. A supply chain management system for electronics..."
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            className="bg-background"
                        />
                        <Button onClick={handleSuggest} disabled={loading || !domain.trim()} className="gap-2">
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
                            {suggestions.map((cls, i) => (
                                <Card key={i} className="bg-background relative group">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-sm font-bold">{cls.name}</CardTitle>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleAddClass(cls, i)}
                                                disabled={addingIds[i] || addedIds[i]}
                                            >
                                                {addingIds[i] ? <Loader2 className="h-4 w-4 animate-spin" /> : addedIds[i] ? <Check className="h-4 w-4 text-green-500" /> : <Plus className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <CardDescription className="text-xs">{cls.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-1">
                                            {cls.properties.map((p, j) => (
                                                <div key={j} className="text-[10px] flex items-center justify-between bg-muted/50 px-2 py-1 rounded">
                                                    <span className="font-mono">{p.name}</span>
                                                    <span className="text-muted-foreground italic">{p.type}</span>
                                                </div>
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
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader>
                        <Database className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Class Designer</CardTitle>
                        <CardDescription>Define entity types and attributes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        Manage ontology classes and their properties.
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader>
                        <Database className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Relationship Designer</CardTitle>
                        <CardDescription>Define links between classes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        Manage relationship types and cardinality rules.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
