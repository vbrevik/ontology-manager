import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { ScheduleEditor } from '@/components/ScheduleEditor'

export const Route = createFileRoute('/admin/schedules')({
    component: SchedulesPage,
})

interface ScopedRole {
    id: string
    user_id: string
    role_id: string
    role_name: string
    scope_entity_id: string | null
    scope_entity_name: string | null
    valid_from: string | null
    valid_until: string | null
    schedule_cron: string | null
    is_deny: boolean
    granted_at: string
}

function SchedulesPage() {
    const [selectedRole, setSelectedRole] = useState<ScopedRole | null>(null)
    const [roles, setRoles] = useState<ScopedRole[]>([])
    const [users, setUsers] = useState<{ id: string; username: string }[]>([])
    const [selectedUserId, setSelectedUserId] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    useEffect(() => {
        fetchUsers()
    }, [])

    useEffect(() => {
        if (selectedUserId) {
            fetchUserRoles(selectedUserId)
        }
    }, [selectedUserId])

    async function fetchUsers() {
        try {
            const res = await fetch('/api/users', { credentials: 'include' })
            if (res.ok) {
                const data = await res.json()
                setUsers(data)
            }
        } catch (err) {
            console.error('Failed to fetch users:', err)
        }
    }

    async function fetchUserRoles(userId: string) {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/rebac/users/${userId}/roles`, { credentials: 'include' })
            if (res.ok) {
                const data = await res.json()
                setRoles(data)
            } else {
                setError('Failed to fetch user roles')
            }
        } catch (err) {
            setError('Failed to fetch user roles')
        } finally {
            setIsLoading(false)
        }
    }

    async function updateSchedule(roleId: string, schedule: string | null) {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/rebac/users/roles/${roleId}/schedule`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ schedule_cron: schedule }),
            })
            if (res.ok) {
                setSuccessMessage('Schedule updated successfully')
                // Refresh roles
                if (selectedUserId) fetchUserRoles(selectedUserId)
                setSelectedRole(null)
                setTimeout(() => setSuccessMessage(null), 3000)
            } else {
                const data = await res.json()
                setError(data.error || 'Failed to update schedule')
            }
        } catch (err) {
            setError('Failed to update schedule')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="schedules-page">
            <style>{`
                .schedules-page {
                    padding: 24px 32px;
                    max-width: 1200px;
                    color: #e0e0e0;
                }
                .schedules-page h1 {
                    font-size: 24px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .schedules-page__subtitle {
                    color: #888;
                    margin-bottom: 24px;
                }
                .schedules-page__section {
                    background: #1e1e1e;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .schedules-page__label {
                    display: block;
                    font-weight: 500;
                    margin-bottom: 8px;
                    color: #e0e0e0;
                }
                .schedules-page__select {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #3a3a3a;
                    border-radius: 6px;
                    background: #2a2a2a;
                    color: #fff;
                    font-size: 14px;
                }
                .schedules-page__roles-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .schedules-page__role-card {
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .schedules-page__role-card:hover {
                    border-color: #6366f1;
                }
                .schedules-page__role-card--selected {
                    border-color: #6366f1;
                    background: rgba(99, 102, 241, 0.1);
                }
                .schedules-page__role-name {
                    font-weight: 600;
                    color: #fff;
                }
                .schedules-page__role-meta {
                    font-size: 12px;
                    color: #888;
                    margin-top: 4px;
                }
                .schedules-page__role-schedule {
                    margin-top: 8px;
                    font-size: 13px;
                }
                .schedules-page__schedule-badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: monospace;
                }
                .schedules-page__schedule-badge--active {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                    border: 1px solid rgba(34, 197, 94, 0.3);
                }
                .schedules-page__schedule-badge--none {
                    background: #333;
                    color: #888;
                }
                .schedules-page__error {
                    padding: 12px;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 6px;
                    color: #ef4444;
                    margin-bottom: 16px;
                }
                .schedules-page__success {
                    padding: 12px;
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 6px;
                    color: #22c55e;
                    margin-bottom: 16px;
                }
                .schedules-page__editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .schedules-page__btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .schedules-page__btn--primary {
                    background: #6366f1;
                    color: #fff;
                    border: none;
                }
                .schedules-page__btn--primary:hover {
                    background: #5558e3;
                }
                .schedules-page__btn--secondary {
                    background: #3a3a3a;
                    color: #fff;
                    border: none;
                }
                .schedules-page__btn--secondary:hover {
                    background: #444;
                }
                .schedules-page__empty {
                    text-align: center;
                    color: #888;
                    padding: 40px;
                }
            `}</style>

            <h1>Schedule Management</h1>
            <p className="schedules-page__subtitle">
                Configure time-based access schedules for user role assignments
            </p>

            {error && <div className="schedules-page__error">{error}</div>}
            {successMessage && <div className="schedules-page__success">{successMessage}</div>}

            <div className="schedules-page__section">
                <label className="schedules-page__label">Select User</label>
                <select
                    className="schedules-page__select"
                    value={selectedUserId}
                    onChange={(e) => {
                        setSelectedUserId(e.target.value)
                        setSelectedRole(null)
                    }}
                >
                    <option value="">-- Select a user --</option>
                    {users.map(user => (
                        <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                </select>
            </div>

            {selectedUserId && (
                <div className="schedules-page__section">
                    <label className="schedules-page__label">Role Assignments</label>
                    {isLoading ? (
                        <div className="schedules-page__empty">Loading...</div>
                    ) : roles.length === 0 ? (
                        <div className="schedules-page__empty">No role assignments for this user</div>
                    ) : (
                        <div className="schedules-page__roles-list">
                            {roles.map(role => (
                                <div
                                    key={role.id}
                                    className={`schedules-page__role-card ${selectedRole?.id === role.id ? 'schedules-page__role-card--selected' : ''}`}
                                    onClick={() => setSelectedRole(role)}
                                >
                                    <div className="schedules-page__role-name">
                                        {role.role_name}
                                        {role.is_deny && <span style={{ color: '#ef4444', marginLeft: 8 }}>(DENY)</span>}
                                    </div>
                                    <div className="schedules-page__role-meta">
                                        Scope: {role.scope_entity_name || 'Global'}
                                        {role.valid_from && ` • From: ${new Date(role.valid_from).toLocaleDateString()}`}
                                        {role.valid_until && ` • Until: ${new Date(role.valid_until).toLocaleDateString()}`}
                                    </div>
                                    <div className="schedules-page__role-schedule">
                                        {role.schedule_cron ? (
                                            <span className="schedules-page__schedule-badge schedules-page__schedule-badge--active">
                                                {role.schedule_cron}
                                            </span>
                                        ) : (
                                            <span className="schedules-page__schedule-badge schedules-page__schedule-badge--none">
                                                No schedule (always active)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {selectedRole && (
                <div className="schedules-page__section">
                    <div className="schedules-page__editor-header">
                        <label className="schedules-page__label" style={{ margin: 0 }}>
                            Edit Schedule for: {selectedRole.role_name}
                        </label>
                        <button
                            className="schedules-page__btn schedules-page__btn--secondary"
                            onClick={() => setSelectedRole(null)}
                        >
                            Cancel
                        </button>
                    </div>
                    <ScheduleEditor
                        value={selectedRole.schedule_cron}
                        onChange={(schedule) => updateSchedule(selectedRole.id, schedule)}
                    />
                </div>
            )}
        </div>
    )
}
