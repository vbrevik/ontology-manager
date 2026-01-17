import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Plus, Trash2, Loader2, Workflow, Check, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    fetchDelegationRules,
    createDelegationRule,
    removeDelegationRule,
    fetchRoles,
    type Role,
    type DelegationRule
} from '@/features/ontology/lib/api'

export const Route = createFileRoute('/admin/roles/delegation')({
    component: DelegationPage,
})

function DelegationPage() {
    const [rules, setRules] = useState<DelegationRule[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Form state
    const [granterRoleId, setGranterRoleId] = useState('')
    const [granteeRoleId, setGranteeRoleId] = useState('')
    const [canGrant, setCanGrant] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [rulesData, rolesData] = await Promise.all([
                fetchDelegationRules(),
                fetchRoles()
            ])
            setRules(rulesData)
            setRoles(rolesData)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleAddRule = async () => {
        if (!granterRoleId || !granteeRoleId) return
        setSubmitting(true)
        setError(null)
        try {
            await createDelegationRule({
                granter_role_id: granterRoleId,
                grantee_role_id: granteeRoleId,
                can_grant: canGrant,
                can_modify: true,
                can_revoke: true
            })
            setSuccess('Delegation rule added successfully')
            setGranterRoleId('')
            setGranteeRoleId('')
            loadData()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Are you sure you want to remove this delegation rule?')) return
        try {
            await removeDelegationRule(id)
            setSuccess('Rule removed')
            loadData()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            setError(err.message)
        }
    }

    const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || id

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Delegation Rules</h1>
                    <p className="text-muted-foreground">
                        Define which roles have authority to grant or manage other roles.
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="bg-green-500/10 text-green-500 border-green-500/20">
                    <Check className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                {/* Rule Creator */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Add New Rule</CardTitle>
                        <CardDescription>Authorize a role to delegate another</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Granter Role</label>
                            <select
                                className="w-full bg-background border rounded-md p-2 text-sm"
                                value={granterRoleId}
                                onChange={e => setGranterRoleId(e.target.value)}
                            >
                                <option value="">Select Role...</option>
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-center">
                            <Workflow className="h-4 w-4 text-muted-foreground rotate-90" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Grantee Role</label>
                            <select
                                className="w-full bg-background border rounded-md p-2 text-sm"
                                value={granteeRoleId}
                                onChange={e => setGranteeRoleId(e.target.value)}
                            >
                                <option value="">Select Role...</option>
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="canGrant"
                                checked={canGrant}
                                onChange={e => setCanGrant(e.target.checked)}
                                className="h-4 w-4 accent-primary"
                            />
                            <label htmlFor="canGrant" className="text-sm">Can Grant Role</label>
                        </div>

                        <Button
                            className="w-full mt-4"
                            disabled={!granterRoleId || !granteeRoleId || submitting}
                            onClick={handleAddRule}
                        >
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Create Rule
                        </Button>
                    </CardContent>
                </Card>

                {/* Rules List */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Active Delegation Matrix</CardTitle>
                        <CardDescription>Current role propagation authorities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {rules.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                No delegation rules defined.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rules.map((rule) => (
                                    <div key={rule.id} className="flex items-center justify-between p-4 bg-muted/30 border rounded-lg group hover:border-primary/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                                <Shield className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm tracking-tight">{getRoleName(rule.granter_role_id)}</span>
                                                    <Workflow className="h-3 w-3 text-muted-foreground" />
                                                    <span className="font-medium text-sm text-indigo-400">{getRoleName(rule.grantee_role_id)}</span>
                                                </div>
                                                <div className="flex gap-4 mt-1">
                                                    <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                                                        <Check className={`h-2.5 w-2.5 ${rule.can_grant ? 'text-green-500' : 'text-red-500'}`} />
                                                        Can Grant
                                                    </span>
                                                    <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                                                        <Check className={`h-2.5 w-2.5 ${rule.can_modify ? 'text-green-500' : 'text-red-500'}`} />
                                                        Can Modify
                                                    </span>
                                                    <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                                                        <Check className={`h-2.5 w-2.5 ${rule.can_revoke ? 'text-green-500' : 'text-red-500'}`} />
                                                        Can Revoke
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                            onClick={() => handleDeleteRule(rule.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
