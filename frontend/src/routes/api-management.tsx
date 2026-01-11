import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Key,
    Webhook,
    Plus,
    Copy,
    Trash2,
    RefreshCw,
    ShieldAlert,
    CheckCircle2,
    Globe,
    Activity
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/api-management')({
    component: ApiManagementPage,
})

type ApiKey = {
    id: string
    name: string
    prefix: string
    createdAt: string
    lastUsed?: string
    status: 'active' | 'revoked'
    scopes: string[]
}

type WebhookEndpoint = {
    id: string
    url: string
    events: string[]
    status: 'active' | 'inactive' | 'failing'
    lastDelivery?: string
    failureCount: number
}

const MOCK_KEYS: ApiKey[] = [
    {
        id: '1',
        name: 'Production Server',
        prefix: 'pk_live_...',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        lastUsed: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        status: 'active',
        scopes: ['read:users', 'write:logs']
    },
    {
        id: '2',
        name: 'Development Test',
        prefix: 'pk_test_...',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        status: 'active',
        scopes: ['read:*', 'write:*']
    },
    {
        id: '3',
        name: 'Legacy Integration',
        prefix: 'pk_live_...',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        status: 'revoked',
        scopes: ['read:users']
    }
]

const MOCK_WEBHOOKS: WebhookEndpoint[] = [
    {
        id: '1',
        url: 'https://api.example.com/webhooks/users',
        events: ['user.created', 'user.updated'],
        status: 'active',
        lastDelivery: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        failureCount: 0
    },
    {
        id: '2',
        url: 'https://monitoring.internal/alerts',
        events: ['system.alert', 'security.breach'],
        status: 'failing',
        lastDelivery: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        failureCount: 5
    }
]

function ApiManagementPage() {
    const [keys, setKeys] = useState<ApiKey[]>(MOCK_KEYS)
    const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(MOCK_WEBHOOKS)
    const [newKeyName, setNewKeyName] = useState('')
    const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
    const [generatedKey, setGeneratedKey] = useState<string | null>(null)

    const handleCreateKey = () => {
        const newKey: ApiKey = {
            id: String(keys.length + 1),
            name: newKeyName,
            prefix: 'pk_live_' + Math.random().toString(36).substring(7),
            createdAt: new Date().toISOString(),
            status: 'active',
            scopes: ['read:*']
        }
        setKeys([newKey, ...keys])
        setGeneratedKey(`${newKey.prefix}${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`)
        setNewKeyName('')
    }

    const handleRevokeKey = (id: string) => {
        setKeys(keys.map(k => k.id === id ? { ...k, status: 'revoked' } : k))
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center">
                        <Key className="mr-3 h-8 w-8 text-indigo-600" />
                        API Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage API keys, access tokens, and webhook integrations
                    </p>
                </div>
            </div>

            <Tabs defaultValue="keys" className="space-y-6">
                <TabsList className="bg-background/40 border border-border/40 p-1">
                    <TabsTrigger value="keys" className="data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-600">
                        <Key className="mr-2 h-4 w-4" /> API Keys
                    </TabsTrigger>
                    <TabsTrigger value="webhooks" className="data-[state=active]:bg-pink-500/10 data-[state=active]:text-pink-600">
                        <Webhook className="mr-2 h-4 w-4" /> Webhooks
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="keys" className="space-y-6">
                    <Card className="border-border/40 bg-background/40">
                        <CardHeader className="border-b border-border/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Active API Keys</CardTitle>
                                    <CardDescription>Keys used to authenticate requests to the API</CardDescription>
                                </div>
                                <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                                            <Plus className="mr-2 h-4 w-4" /> Create New Key
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Create API Key</DialogTitle>
                                            <DialogDescription>
                                                Generate a new key for accessing the API. Treat this key like a password.
                                            </DialogDescription>
                                        </DialogHeader>

                                        {!generatedKey ? (
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Key Name</Label>
                                                    <Input
                                                        placeholder="e.g. Production Server"
                                                        value={newKeyName}
                                                        onChange={(e) => setNewKeyName(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 py-4">
                                                <Alert className="bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <AlertTitle>Key Generated Successfully</AlertTitle>
                                                    <AlertDescription>
                                                        Copy this key now. You won't be able to see it again.
                                                    </AlertDescription>
                                                </Alert>
                                                <div className="flex items-center space-x-2">
                                                    <Input value={generatedKey} readOnly className="font-mono text-xs" />
                                                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(generatedKey)}>
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        <DialogFooter>
                                            {!generatedKey ? (
                                                <Button onClick={handleCreateKey} disabled={!newKeyName}>Generate Key</Button>
                                            ) : (
                                                <Button onClick={() => {
                                                    setShowNewKeyDialog(false)
                                                    setGeneratedKey(null)
                                                }}>Done</Button>
                                            )}
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/40">
                                {keys.map((key) => (
                                    <div key={key.id} className={cn(
                                        "p-6 flex items-start justify-between transition-colors",
                                        key.status === 'revoked' ? "opacity-60 bg-muted/20" : "hover:bg-muted/10"
                                    )}>
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-3">
                                                <h3 className="font-bold text-sm flex items-center">
                                                    {key.name}
                                                    {key.status === 'revoked' && (
                                                        <Badge variant="destructive" className="ml-2 text-[10px] h-5">REVOKED</Badge>
                                                    )}
                                                </h3>
                                                <code className="text-xs bg-muted/50 px-2 py-0.5 rounded text-muted-foreground font-mono">
                                                    {key.prefix}****************
                                                </code>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Created {new Date(key.createdAt).toLocaleDateString()}
                                                {key.lastUsed && ` · Last used ${new Date(key.lastUsed).toLocaleDateString()}`}
                                            </p>
                                            <div className="flex gap-2 mt-2">
                                                {key.scopes.map(scope => (
                                                    <Badge key={scope} variant="secondary" className="text-[10px] bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                                                        {scope}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        {key.status === 'active' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                                onClick={() => handleRevokeKey(key.id)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" /> Revoke
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="webhooks" className="space-y-6">
                    <Card className="border-border/40 bg-background/40">
                        <CardHeader className="border-b border-border/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Webhook Endpoints</CardTitle>
                                    <CardDescription>Receive real-time events at your URL</CardDescription>
                                </div>
                                <Button className="bg-pink-600 hover:bg-pink-700">
                                    <Plus className="mr-2 h-4 w-4" /> Add Endpoint
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/40">
                                {webhooks.map((webhook) => (
                                    <div key={webhook.id} className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center space-x-3">
                                                <div className={cn(
                                                    "p-2 rounded-lg",
                                                    webhook.status === 'active' ? "bg-green-500/10 text-green-600" :
                                                        webhook.status === 'failing' ? "bg-red-500/10 text-red-600" :
                                                            "bg-muted text-muted-foreground"
                                                )}>
                                                    <Globe className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center space-x-2">
                                                        <h3 className="font-bold text-sm font-mono">{webhook.url}</h3>
                                                        {webhook.status === 'failing' && (
                                                            <Badge variant="destructive" className="text-[10px]">Failing</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center space-x-2 mt-1">
                                                        {webhook.events.map(event => (
                                                            <Badge key={event} variant="outline" className="text-[10px]">
                                                                {event}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Button size="icon" variant="ghost">
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {webhook.status === 'failing' && (
                                            <Alert variant="destructive" className="mt-2 bg-red-500/5 border-red-500/20">
                                                <ShieldAlert className="h-4 w-4" />
                                                <AlertTitle>Delivery Failed</AlertTitle>
                                                <AlertDescription>
                                                    Last {webhook.failureCount} delivery attempts failed. Recent error: Connection refused.
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-2">
                                            <Activity className="h-3 w-3" />
                                            <span>Last delivery: {new Date(webhook.lastDelivery!).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
