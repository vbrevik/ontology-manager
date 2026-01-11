import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
    fetchRoles,
    fetchAccessMatrix,
    type Role
} from '@/features/ontology/lib/api'
import { getUsers, assignRoleToUser, removeRoleFromUser, type User } from '@/features/users/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { LayoutGrid, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/access/Matrix')({
    component: MatrixPage,
})

function MatrixPage() {
    const [users, setUsers] = useState<User[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [matrix, setMatrix] = useState<Record<string, string[]>>({})
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [refreshing, setRefreshing] = useState(false)
    const { toast } = useToast()

    const LIMIT = 10

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        loadUsersAndMatrix(page)
    }, [page])

    async function loadInitialData() {
        try {
            const rolesData = await fetchRoles()
            setRoles(rolesData.sort((a, b) => a.name.localeCompare(b.name)))
            // Users are loaded in the page effect
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load roles'
            })
        }
    }

    async function loadUsersAndMatrix(pageNum: number) {
        setRefreshing(true)
        try {
            const { users: usersData, total } = await getUsers({ page: pageNum, limit: LIMIT })
            setUsers(usersData)
            setTotalPages(Math.ceil(total / LIMIT))

            if (usersData.length > 0) {
                const matrixData = await fetchAccessMatrix(usersData.map(u => u.id))
                setMatrix(matrixData)
            } else {
                setMatrix({})
            }
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load matrix data'
            })
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    async function handleToggleRole(userId: string, roleName: string, hasRole: boolean) {
        // Optimistic update
        const originalMatrix = { ...matrix }
        setMatrix(prev => {
            const userRoles = prev[userId] || []
            const nextRoles = hasRole
                ? userRoles.filter(r => r !== roleName)
                : [...userRoles, roleName]
            return { ...prev, [userId]: nextRoles }
        })

        try {
            // Find role ID
            const role = roles.find(r => r.name === roleName)
            if (!role) throw new Error('Role not found')

            if (hasRole) {
                // User has it, so we are removing
                // Note: This only revokes active roles found. 
                // Creating a proper revoke logic might require finding the specific assignment ID if it's scoped.
                // For MVP Matrix, we assume simple global role assignment/removal or we need to implementation specific "revoke by role name"
                // Our current API might need specific assignment ID for scoped roles.
                // Let's check `removeRoleFromUser` in users/lib/api.ts
                await removeRoleFromUser(userId, role.id)
            } else {
                // Assign global role
                await assignRoleToUser(userId, { roleId: role.id })
            }

            toast({
                title: "Success",
                description: `Role ${roleName} ${hasRole ? 'revoked' : 'assigned'}`
            })
        } catch (err) {
            // Revert
            setMatrix(originalMatrix)
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update role assignment. Note: Complex scoped roles cannot be managed here.'
            })
        }
    }

    if (loading && roles.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">Loading access matrix...</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="border-border/40 shadow-sm bg-background/50 backdrop-blur-sm overflow-hidden">
                <div className="p-4 border-b border-border/40 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <LayoutGrid className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-bold uppercase tracking-wider">Access Matrix</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => loadUsersAndMatrix(page)} disabled={refreshing}>
                        <RefreshCw className={cn("mr-2 h-3 w-3", refreshing && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[250px] sticky left-0 bg-background/95 backdrop-blur z-20 font-bold">User</TableHead>
                                {roles.map(role => (
                                    <TableHead key={role.id} className="text-center min-w-[100px] font-semibold whitespace-nowrap">
                                        <div className="flex flex-col items-center justify-center space-y-1 py-2">
                                            <span>{role.name}</span>
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(user => {
                                const userRoles = matrix[user.id] || []
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell className="sticky left-0 bg-background/95 backdrop-blur z-10 font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold">{user.username}</span>
                                                <span className="text-[10px] text-muted-foreground">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        {roles.map(role => {
                                            const hasRole = userRoles.includes(role.name)
                                            return (
                                                <TableCell key={`${user.id}-${role.id}`} className="text-center p-0">
                                                    <div className="flex items-center justify-center h-full w-full py-3">
                                                        <Checkbox
                                                            checked={hasRole}
                                                            onCheckedChange={() => handleToggleRole(user.id, role.name, hasRole)}
                                                            className={cn(
                                                                "h-5 w-5 transition-all data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500",
                                                                !hasRole && "opacity-20 hover:opacity-100"
                                                            )}
                                                        />
                                                    </div>
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
                <div className="p-4 border-t border-border/40 flex items-center justify-between bg-muted/5">
                    <div className="text-xs text-muted-foreground">
                        Showing {(page - 1) * LIMIT + 1} to {Math.min(page * LIMIT, (page * LIMIT))} users
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-semibold px-2">Page {page} of {totalPages || 1}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="flex items-start space-x-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Scoped Roles Notice</h4>
                    <p className="text-xs text-muted-foreground">
                        This matrix shows effectively active roles. Toggling a role here assigns/revokes it at the <strong>Global</strong> scope.
                        Complex scoped assignments (temporal, tenant-specific) should be managed in the User Details view to avoid accidental data loss.
                    </p>
                </div>
            </div>
        </div>
    )
}
