import React, { useEffect, useState } from 'react'
import { getPasswordStrength } from '@/lib/password'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getCsrfToken } from '@/features/auth/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Save, X, Edit2, AlertCircle, CheckCircle2, Eye, Calendar, Terminal, Shield, Key, RefreshCw, Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { UserRolesPanel } from './UserRolesPanel'
import { UserActivityLog } from './UserActivityLog'
import { cn } from '@/lib/utils'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

function TabButton({ id, label, activeTab, onClick }: { id: string, label: string, activeTab: string, onClick: (id: string) => void }) {
    const active = activeTab === id
    return (
        <button
            onClick={() => onClick(id)}
            className={cn(
                "pb-2 px-1 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
                active
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-slate-300"
            )}
        >
            {label}
        </button>
    )
}

function Tabs({ children, className }: { children: React.ReactNode, defaultValue?: string, className?: string }) {
    return <div className={className}>{children}</div>
}

export type User = {
    id: string
    username: string
    email: string
    created_at: string
    last_login_ip?: string | null
    last_user_agent?: string | null
    last_login_at?: string | null
    notification_preferences?: string | null
}


export default function UserManagement() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [editAccordionOpen, setEditAccordionOpen] = useState<Record<string, boolean>>({})
    const [expandedTabs, setExpandedTabs] = useState<Record<string, string>>({})

    // Create User State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newUser, setNewUser] = useState({ username: '', email: '', password: '' })
    const [createError, setCreateError] = useState<string | null>(null)

    // Form state
    const [userPasswords, setUserPasswords] = useState<Record<string, { password: string, forceChange: boolean }>>({})
    const [userEdits, setUserEdits] = useState<Record<string, { username: string, email: string }>>({})

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users', { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch users')
            const data = await res.json()
            setUsers(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])


    const clearMessages = () => {
        setError(null)
        setSuccessMessage(null)
        setCreateError(null)
    }

    const [userToDelete, setUserToDelete] = useState<string | null>(null)

    const handleDeleteClick = (id: string) => {
        setUserToDelete(id)
    }

    const confirmDelete = async () => {
        if (!userToDelete) return
        clearMessages()
        const token = getCsrfToken()
        if (!token) {
            setError('CSRF session expired. Please refresh the page.')
            setUserToDelete(null)
            return
        }

        try {
            const res = await fetch(`/api/users/${userToDelete}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': token,
                },
                credentials: 'include',
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || 'Failed to delete user')
            }
            setSuccessMessage('User deleted successfully')
            fetchUsers()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setUserToDelete(null)
        }
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        clearMessages()

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken() || '',
                },
                body: JSON.stringify(newUser),
                credentials: 'include',
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || 'Failed to create user')
            }

            setSuccessMessage('User created successfully')
            setIsCreateOpen(false)
            setNewUser({ username: '', email: '', password: '' })
            fetchUsers()
        } catch (err: any) {
            setCreateError(err.message)
        }
    }

    const toggleExpand = (userId: string) => {
        setExpandedUserId(expandedUserId === userId ? null : userId)
        // Close edit accordion when toggling view
        if (editAccordionOpen[userId]) {
            setEditAccordionOpen(prev => ({ ...prev, [userId]: false }))
        }
    }

    const toggleEditAccordion = (userId: string, user: User) => {
        const isOpening = !editAccordionOpen[userId]

        // Close the view accordion when opening edit
        if (isOpening && expandedUserId === userId) {
            setExpandedUserId(null)
        }

        setEditAccordionOpen(prev => ({
            ...prev,
            [userId]: isOpening
        }))
        // Initialize edit form with current values when opening
        if (isOpening) {
            setUserEdits(prev => ({
                ...prev,
                [userId]: {
                    username: user.username,
                    email: user.email
                }
            }))
        }
    }

    const updateUserEdit = (userId: string, field: 'username' | 'email', value: string) => {
        setUserEdits(prev => ({
            ...prev,
            [userId]: {
                username: field === 'username' ? value : prev[userId]?.username || '',
                email: field === 'email' ? value : prev[userId]?.email || ''
            }
        }))
    }

    const handleUpdateUser = async (e: React.FormEvent, userId: string) => {
        e.preventDefault()
        clearMessages()

        const userEdit = userEdits[userId]
        if (!userEdit) return

        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken() || '',
                },
                body: JSON.stringify({ username: userEdit.username, email: userEdit.email }),
                credentials: 'include',
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || 'Failed to update user')
            }

            setSuccessMessage('User updated successfully')
            setUserEdits(prev => {
                const newState = { ...prev }
                delete newState[userId]
                return newState
            })
            setEditAccordionOpen(prev => ({ ...prev, [userId]: false }))
            fetchUsers()
        } catch (err: any) {
            setError(err.message)
        }
    }

    const updateUserPassword = (userId: string, field: 'password' | 'forceChange', value: string | boolean) => {
        setUserPasswords(prev => ({
            ...prev,
            [userId]: {
                password: field === 'password' ? value as string : prev[userId]?.password || '',
                forceChange: field === 'forceChange' ? value as boolean : prev[userId]?.forceChange || false
            }
        }))
    }

    if (loading) return <div className="p-6">Loading users...</div>

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">User Management</h1>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create User
                </Button>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New User</DialogTitle>
                            <DialogDescription>
                                Add a new user to the system. They will be able to log in immediately.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            {createError && (
                                <Alert variant="destructive">
                                    <AlertDescription>{createError}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="new-username">Username</Label>
                                <Input
                                    id="new-username"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                                    required
                                    minLength={3}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-email">Email</Label>
                                <Input
                                    id="new-email"
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">Password</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Create User</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-4 py-2 px-3 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs uppercase font-bold">Error</AlertTitle>
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
            )}

            {successMessage && (
                <Alert className="mb-4 py-2 px-3 text-sm border-green-500 bg-green-50 text-green-700">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertTitle className="text-xs uppercase font-bold">Success</AlertTitle>
                    <AlertDescription className="text-xs">{successMessage}</AlertDescription>
                </Alert>
            )}

            <div className="border rounded-lg overflow-hidden bg-background">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Username</th>
                            <th className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Email</th>
                            <th className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-12 text-center text-muted-foreground italic text-sm">
                                    No users found.
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <React.Fragment key={user.id}>
                                    <tr className={`hover:bg-slate-50/50 transition-colors ${expandedUserId === user.id ? 'bg-primary/5' : ''}`}>
                                        <td className="py-2 px-4">
                                            <div className="font-medium text-sm">{user.username}</div>
                                            <div className="text-[10px] text-muted-foreground sm:hidden">{user.email}</div>
                                        </td>
                                        <td className="py-2 px-4 text-sm text-slate-600 hidden sm:table-cell">{user.email}</td>
                                        <td className="py-2 px-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 ${expandedUserId === user.id ? 'text-primary' : 'text-slate-400'}`}
                                                    onClick={() => toggleExpand(user.id)}
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 ${editAccordionOpen[user.id] ? 'text-primary' : 'text-slate-400 hover:text-blue-600'}`}
                                                    onClick={() => toggleEditAccordion(user.id, user)}
                                                    title="Edit User"
                                                >
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                                                    onClick={() => handleDeleteClick(user.id)}
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedUserId === user.id && (
                                        <tr className="bg-primary/5 border-b shadow-inner">
                                            <td colSpan={4} className="p-0">
                                                <div className="px-12 py-4 animate-in slide-in-from-top-2 duration-200">
                                                    <Tabs defaultValue="profile" className="w-full">
                                                        <div className="flex items-center gap-4 border-b mb-4">
                                                            <TabButton id="profile" label="Profile" activeTab={expandedTabs[user.id] || 'profile'} onClick={(id) => setExpandedTabs(prev => ({ ...prev, [user.id]: id }))} />
                                                            <TabButton id="roles" label="Roles & Access" activeTab={expandedTabs[user.id] || 'profile'} onClick={(id) => setExpandedTabs(prev => ({ ...prev, [user.id]: id }))} />
                                                            <TabButton id="activity" label="Activity" activeTab={expandedTabs[user.id] || 'profile'} onClick={(id) => setExpandedTabs(prev => ({ ...prev, [user.id]: id }))} />
                                                        </div>

                                                        {(expandedTabs[user.id] || 'profile') === 'profile' && (
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-2">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-slate-500">
                                                                        <Calendar size={14} />
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Created</span>
                                                                    </div>
                                                                    <p className="text-xs font-medium">{new Date(user.created_at).toLocaleString()}</p>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-slate-500">
                                                                        <Terminal size={14} />
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Last Login IP</span>
                                                                    </div>
                                                                    <p className="text-xs font-mono">{user.last_login_ip || 'n/a'}</p>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-slate-500">
                                                                        <CheckCircle2 size={14} />
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider">Last Activity</span>
                                                                    </div>
                                                                    <p className="text-xs font-medium">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</p>
                                                                </div>
                                                                <div className="md:col-span-3 space-y-2">
                                                                    <div className="flex items-center gap-2 text-slate-500">
                                                                        <Shield size={14} />
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider">User Agent</span>
                                                                    </div>
                                                                    <p className="text-[11px] bg-background p-2 rounded border font-mono break-all leading-relaxed">
                                                                        {user.last_user_agent || 'No agent recorded'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(expandedTabs[user.id] === 'roles') && (
                                                            <div className="py-2">
                                                                <UserRolesPanel userId={user.id} />
                                                            </div>
                                                        )}

                                                        {(expandedTabs[user.id] === 'activity') && (
                                                            <div className="py-2">
                                                                <UserActivityLog userId={user.id} />
                                                            </div>
                                                        )}
                                                    </Tabs>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {editAccordionOpen[user.id] && (
                                        <tr className="bg-blue-50/50 dark:bg-blue-950/20 border-b shadow-inner">
                                            <td colSpan={4} className="p-0">
                                                <div className="px-12 py-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-900/50">
                                                        <form onSubmit={(e) => handleUpdateUser(e, user.id)} className="space-y-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                    <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Username</label>
                                                                    <Input
                                                                        value={userEdits[user.id]?.username || ''}
                                                                        onChange={e => updateUserEdit(user.id, 'username', e.target.value)}
                                                                        required
                                                                        className="h-9"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</label>
                                                                    <Input
                                                                        type="email"
                                                                        value={userEdits[user.id]?.email || ''}
                                                                        onChange={e => updateUserEdit(user.id, 'email', e.target.value)}
                                                                        required
                                                                        className="h-9"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Password Section */}
                                                            <div className="pt-4 border-t">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <Key size={14} className="text-orange-600" />
                                                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password Management</h4>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between items-center">
                                                                            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">New Password (Optional)</label>
                                                                            {userPasswords[user.id]?.password && (
                                                                                <span className="text-[9px] font-bold uppercase tracking-wider">
                                                                                    {getPasswordStrength(userPasswords[user.id]?.password).label}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <Input
                                                                            type="password"
                                                                            value={userPasswords[user.id]?.password || ''}
                                                                            onChange={e => updateUserPassword(user.id, 'password', e.target.value)}
                                                                            className="h-9"
                                                                            placeholder="Leave blank to keep current password"
                                                                        />
                                                                        {userPasswords[user.id]?.password && (
                                                                            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
                                                                                <div
                                                                                    className={`h-full ${getPasswordStrength(userPasswords[user.id]?.password).color} transition-all duration-300`}
                                                                                    style={{
                                                                                        width: getPasswordStrength(userPasswords[user.id]?.password).label === 'Strong' ? '100%' :
                                                                                            getPasswordStrength(userPasswords[user.id]?.password).label === 'Medium' ? '66%' : '33%'
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900/50">
                                                                        <input
                                                                            type="checkbox"
                                                                            id={`forceChange-${user.id}`}
                                                                            checked={userPasswords[user.id]?.forceChange || false}
                                                                            onChange={e => updateUserPassword(user.id, 'forceChange', e.target.checked)}
                                                                            className="h-4 w-4 rounded border-slate-300"
                                                                        />
                                                                        <label htmlFor={`forceChange-${user.id}`} className="text-xs font-medium flex items-center gap-2 cursor-pointer">
                                                                            <RefreshCw size={12} className="text-orange-600" />
                                                                            Force user to change password on next login
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-2 pt-2">
                                                                <Button type="submit" size="sm" className="flex-1 gap-2 h-9">
                                                                    <Save size={16} /> Update User
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setUserEdits(prev => {
                                                                            const newState = { ...prev }
                                                                            delete newState[user.id]
                                                                            return newState
                                                                        })
                                                                        setUserPasswords(prev => {
                                                                            const newState = { ...prev }
                                                                            delete newState[user.id]
                                                                            return newState
                                                                        })
                                                                        setEditAccordionOpen(prev => ({ ...prev, [user.id]: false }))
                                                                    }}
                                                                    className="h-9"
                                                                >
                                                                    <X size={16} /> Cancel
                                                                </Button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
