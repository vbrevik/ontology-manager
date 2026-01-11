import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Shield, RefreshCw, Key, Copy, CheckCircle2, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/admin/rate-limits')({
    component: RateLimitsPage,
})

interface RateLimitRule {
    id: string
    name: string
    endpoint_pattern: string
    max_requests: number
    window_seconds: number
    strategy: 'IP' | 'User' | 'Global'
    enabled: boolean
}

interface BypassToken {
    id: string
    token: string
    description: string | null
    created_at: string
}

function RateLimitsPage() {
    const [rules, setRules] = useState<RateLimitRule[]>([])
    const [tokens, setTokens] = useState<BypassToken[]>([])
    const [editingRule, setEditingRule] = useState<string | null>(null)
    const [editValues, setEditValues] = useState<Partial<RateLimitRule>>({})
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [copiedToken, setCopiedToken] = useState<string | null>(null)

    useEffect(() => {
        loadRules()
        loadTokens()
    }, [])

    const loadRules = async () => {
        try {
            const res = await fetch('/api/rate-limits/rules', { credentials: 'include' })
            if (res.ok) {
                setRules(await res.json())
            }
        } catch (error) {
            console.error('Failed to load rules:', error)
        }
    }

    const loadTokens = async () => {
        try {
            const res = await fetch('/api/rate-limits/bypass-tokens', { credentials: 'include' })
            if (res.ok) {
                setTokens(await res.json())
            }
        } catch (error) {
            console.error('Failed to load tokens:', error)
        }
    }

    const startEdit = (rule: RateLimitRule) => {
        setEditingRule(rule.id)
        setEditValues({
            name: rule.name,
            max_requests: rule.max_requests,
            window_seconds: rule.window_seconds,
            enabled: rule.enabled,
        })
    }

    const cancelEdit = () => {
        setEditingRule(null)
        setEditValues({})
    }

    const saveRule = async (ruleId: string) => {
        try {
            const res = await fetch(`/api/rate-limits/rules/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(editValues),
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Rule updated successfully' })
                loadRules()
                cancelEdit()
            } else {
                setMessage({ type: 'error', text: 'Failed to update rule' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Network error' })
        }
    }

    const toggleRule = async (ruleId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/rate-limits/rules/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled }),
            })

            if (res.ok) {
                setMessage({ type: 'success', text: `Rule ${enabled ? 'enabled' : 'disabled'}` })
                loadRules()
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to toggle rule' })
        }
    }

    const resetCounters = async (ruleId: string) => {
        try {
            const res = await fetch(`/api/rate-limits/rules/${ruleId}/reset`, {
                method: 'POST',
                credentials: 'include',
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Counters reset successfully' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to reset counters' })
        }
    }

    const createToken = async () => {
        try {
            const res = await fetch('/api/rate-limits/bypass-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ description: 'Admin generated token' }),
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Bypass token created' })
                loadTokens()
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to create token' })
        }
    }

    const copyToken = (token: string) => {
        navigator.clipboard.writeText(token)
        setCopiedToken(token)
        setTimeout(() => setCopiedToken(null), 2000)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        Rate Limiting Configuration
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage API rate limits and bypass tokens
                    </p>
                </div>
                <Button onClick={() => { loadRules(); loadTokens(); }} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {message && (
                <Alert className={`mb-6 ${message.type === 'success' ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            {/* Rate Limit Rules */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-lg">Rate Limit Rules</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {rules.map((rule) => (
                            <div key={rule.id} className="border rounded-lg p-4 space-y-3">
                                {editingRule === rule.id ? (
                                    // Edit mode
                                    <div className="space-y-3">
                                        <Input
                                            value={editValues.name || ''}
                                            onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                            placeholder="Rule name"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-muted-foreground">Max Requests</label>
                                                <Input
                                                    type="number"
                                                    value={editValues.max_requests || ''}
                                                    onChange={(e) => setEditValues({ ...editValues, max_requests: parseInt(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Window (seconds)</label>
                                                <Input
                                                    type="number"
                                                    value={editValues.window_seconds || ''}
                                                    onChange={(e) => setEditValues({ ...editValues, window_seconds: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => saveRule(rule.id)}>Save</Button>
                                            <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                                        </div>
                                    </div>
                                ) : (
                                    // View mode
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold">{rule.name}</h3>
                                                <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                                                    {rule.enabled ? 'Enabled' : 'Disabled'}
                                                </Badge>
                                                <Badge variant="outline">{rule.strategy}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground font-mono">{rule.endpoint_pattern}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {rule.max_requests} requests per {rule.window_seconds}s
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => startEdit(rule)}>Edit</Button>
                                            <Button
                                                size="sm"
                                                variant={rule.enabled ? 'destructive' : 'default'}
                                                onClick={() => toggleRule(rule.id, !rule.enabled)}
                                            >
                                                {rule.enabled ? 'Disable' : 'Enable'}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => resetCounters(rule.id)}>
                                                Reset
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Bypass Tokens */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Bypass Tokens
                    </CardTitle>
                    <Button size="sm" onClick={createToken}>
                        Generate New Token
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {tokens.map((token) => (
                            <div key={token.id} className="flex items-center justify-between border rounded-lg p-3">
                                <div className="flex-1">
                                    <div className="font-mono text-sm break-all">{token.token}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Created: {new Date(token.created_at).toLocaleDateString()}
                                        {token.description && ` • ${token.description}`}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToken(token.token)}
                                    className="ml-4"
                                >
                                    {copiedToken === token.token ? (
                                        <><CheckCircle2 className="h-4 w-4 mr-1" /> Copied</>
                                    ) : (
                                        <><Copy className="h-4 w-4 mr-1" /> Copy</>
                                    )}
                                </Button>
                            </div>
                        ))}
                        {tokens.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No bypass tokens yet. Generate one to bypass rate limits in testing.
                            </p>
                        )}
                    </div>
                    <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            Use bypass tokens in the <code className="bg-muted px-1 py-0.5 rounded">X-Test-Bypass-Token</code> header to bypass rate limits during testing.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    )
}
