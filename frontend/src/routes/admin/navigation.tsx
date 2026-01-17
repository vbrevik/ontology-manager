import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { fetchPermissionTypes, type PermissionType } from '@/features/ontology/lib/api'
import { simulateNavigation, type NavigationSimulation } from '@/features/navigation/lib/api'
import { useAuth } from '@/features/auth/lib/context'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/navigation')({
  component: NavigationSimulator,
})

function NavigationSimulator() {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<PermissionType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<Set<string>>(new Set())
  const [proposed, setProposed] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<NavigationSimulation | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPermissionTypes()
        if (!mounted) return
        const uiPermissions = data.filter((perm) => perm.name.startsWith('ui.'))
        setPermissions(uiPermissions)
        const initial = new Set(user?.permissions || [])
        setBaseline(new Set(initial))
        setProposed(new Set(initial))
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load permissions')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [user])

  const permissionList = useMemo(() => permissions.map((p) => p.name), [permissions])

  const handleToggle = (target: Set<string>, setter: (next: Set<string>) => void, name: string) => {
    const next = new Set(target)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    setter(next)
  }

  const handleSimulate = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await simulateNavigation(
        Array.from(baseline).filter((p) => permissionList.includes(p)),
        Array.from(proposed).filter((p) => permissionList.includes(p)),
      )
      setResult(response)
    } catch (err: any) {
      setError(err.message || 'Failed to simulate navigation')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const initial = new Set(user?.permissions || [])
    setBaseline(new Set(initial))
    setProposed(new Set(initial))
    setResult(null)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Navigation Simulator</h1>
          <p className="text-muted-foreground">
            Preview how permission changes affect visible navigation items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset}>Reset</Button>
          <Button onClick={handleSimulate} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Simulate
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="nav-sim-baseline">
          <CardHeader>
            <CardTitle className="text-base">Baseline Permissions</CardTitle>
            <CardDescription>Current access for comparison.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
            {permissions.length === 0 && (
              <div className="text-sm text-muted-foreground">No UI permissions found.</div>
            )}
            {permissions.map((perm) => (
              <label key={perm.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                <Checkbox
                  checked={baseline.has(perm.name)}
                  onCheckedChange={() => handleToggle(baseline, setBaseline, perm.name)}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium">{perm.name}</div>
                  {perm.description && (
                    <div className="text-xs text-muted-foreground">{perm.description}</div>
                  )}
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="nav-sim-proposed">
          <CardHeader>
            <CardTitle className="text-base">Proposed Permissions</CardTitle>
            <CardDescription>Target access to compare against baseline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
            {permissions.length === 0 && (
              <div className="text-sm text-muted-foreground">No UI permissions found.</div>
            )}
            {permissions.map((perm) => (
              <label key={perm.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                <Checkbox
                  checked={proposed.has(perm.name)}
                  onCheckedChange={() => handleToggle(proposed, setProposed, perm.name)}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium">{perm.name}</div>
                  {perm.description && (
                    <div className="text-xs text-muted-foreground">{perm.description}</div>
                  )}
                </div>
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      {result && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Impact Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Badge className="bg-emerald-500/10 text-emerald-700">
                +{result.summary.added} added
              </Badge>
              <Badge className="bg-rose-500/10 text-rose-700">
                -{result.summary.removed} removed
              </Badge>
              <Badge variant="secondary">
                {result.summary.unchanged} unchanged
              </Badge>
            </CardContent>
          </Card>

          <Card data-testid="nav-sim-added">
            <CardHeader>
              <CardTitle className="text-base">Newly Visible</CardTitle>
              <CardDescription>Items that appear with proposed permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.added_items.length === 0 && (
                <div className="text-sm text-muted-foreground">No added items.</div>
              )}
              {result.added_items.map((item) => (
                <div key={item.id} className="rounded-md border p-2 text-sm">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.section_label}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card data-testid="nav-sim-removed">
            <CardHeader>
              <CardTitle className="text-base">Hidden After Change</CardTitle>
              <CardDescription>Items removed by proposed permissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.removed_items.length === 0 && (
                <div className="text-sm text-muted-foreground">No removed items.</div>
              )}
              {result.removed_items.map((item) => (
                <div key={item.id} className="rounded-md border p-2 text-sm">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.section_label}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Unchanged</CardTitle>
              <CardDescription>Items not affected by the change.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.unchanged_items.length === 0 && (
                <div className="text-sm text-muted-foreground">No unchanged items.</div>
              )}
              {result.unchanged_items.map((item) => (
                <div key={item.id} className={cn('rounded-md border p-2 text-sm')}>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.section_label}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
