import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getUserInfo, changePassword, updateProfile, listSessions, revokeSession, type Session } from '@/features/auth/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { User, Lock, Mail, AlertCircle, CheckCircle2, Shield, Smartphone, Laptop, Trash2 } from 'lucide-react'
import { getPasswordStrength } from '@/lib/password'
import { MfaSetup } from '@/features/auth/components/MfaSetup'

export const Route = createFileRoute('/profile')({
  component: Profile,
})

function Profile() {
  const [username, setUsername] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [editUsername, setEditUsername] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const user = await getUserInfo()
      if (!mounted) return
      setUsername(user?.username ?? '')
      setEditUsername(user?.username ?? '')
      setEmail(user?.email ?? '')

      setSessionsLoading(true)
      const sessionList = await listSessions()
      if (mounted) {
        setSessions(sessionList)
        setSessionsLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  async function onUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setIsSuccess(false)

    if (!editUsername.trim()) {
      setMessage('Username cannot be empty')
      return
    }

    setProfileLoading(true)
    const res = await updateProfile(editUsername)
    setProfileLoading(false)

    if (res.success) {
      setIsSuccess(true)
      setMessage('Profile updated successfully')
      setUsername(editUsername)
      setIsEditing(false)
    } else {
      setMessage(res.error || 'Failed to update profile')
    }
  }

  async function onUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setIsSuccess(false)

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation do not match')
      return
    }
    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const res = await changePassword(email, currentPassword, newPassword)
    setLoading(false)

    if (res.success) {
      setIsSuccess(true)
      setMessage('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setMessage(res.error || 'Failed to change password')
    }
  }

  async function onRevokeSession(id: string) {
    const res = await revokeSession(id)
    if (res.success) {
      setSessions(sessions.filter(s => s.id !== id))
    } else {
      setMessage(res.error || 'Failed to revoke session')
    }
  }

  const strength = getPasswordStrength(newPassword)

  return (
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
      </div>

      {message && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          {isSuccess ? (
            <Alert className="mb-6 py-3 px-4 text-sm border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle className="text-xs uppercase font-bold tracking-wider">Success</AlertTitle>
              <AlertDescription className="text-xs">{message}</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="mb-6 py-3 px-4 text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs uppercase font-bold tracking-wider">Error</AlertTitle>
              <AlertDescription className="text-xs">{message}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Information Card */}
        <Card className="border-border/40 overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="py-4 px-5 bg-muted/30 border-b border-border/40">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={18} className="text-primary" />
                Account Details
              </div>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] uppercase font-bold"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-5 px-5 space-y-5">
            <form onSubmit={onUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <User size={12} /> Username
                </label>
                {isEditing ? (
                  <Input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="h-9 transition-all focus:ring-1"
                    placeholder="Enter new username"
                  />
                ) : (
                  <div className="px-4 py-2.5 bg-muted/40 rounded-lg text-sm font-medium border border-border/40 group-hover:border-primary/20 transition-colors">
                    {username || <span className="text-muted-foreground italic">Loading...</span>}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 opacity-80">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Mail size={12} /> Email Address
                </label>
                <div className="px-4 py-2.5 bg-muted/20 rounded-lg text-sm font-medium border border-border/20 cursor-not-allowed">
                  {email || <span className="text-muted-foreground italic">Loading...</span>}
                </div>
                <p className="text-[9px] text-muted-foreground italic pl-1">Email cannot be changed currently</p>
              </div>

              {isEditing && (
                <div className="flex gap-2 pt-2 animate-in zoom-in-95 duration-200">
                  <Button type="submit" disabled={profileLoading} size="sm" className="h-8 text-[11px] font-bold">
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px] font-bold"
                    onClick={() => {
                      setIsEditing(false)
                      setEditUsername(username)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Security Settings Card */}
        <Card className="border-border/40 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="py-4 px-5 bg-muted/30 border-b border-border/40">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              <h2 className="text-base font-semibold">Active Sessions</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-0">
            <div className="max-h-[250px] overflow-y-auto">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">No active sessions found.</div>
              ) : (
                <div className="divide-y divide-border/20">
                  {sessions.map((session) => (
                    <div key={session.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted/50 rounded-lg text-primary">
                          {session.user_agent?.toLowerCase().includes('mobile') ? <Smartphone size={16} /> : <Laptop size={16} />}
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-bold flex items-center gap-2">
                            {session.ip_address || 'Unknown IP'}
                            {session.is_current && (
                              <span className="text-[8px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full uppercase tracking-tighter">Current</span>
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate max-w-[150px]">
                            {session.user_agent || 'Unknown Device'}
                          </div>
                          <div className="text-[9px] text-muted-foreground/60 italic">
                            Last seen: {new Date(session.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {!session.is_current && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => onRevokeSession(session.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MFA Setup */}
        <div className="md:col-span-2">
          <MfaSetup />
        </div>
      </div>

      {/* Change Password Card */}
      <Card className="mt-8 border-primary/10 bg-primary/[0.02] overflow-hidden shadow-sm">
        <CardHeader className="py-4 px-5 border-b border-primary/5">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock size={18} className="text-primary" />
            Security & Password
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 px-5">
          <form onSubmit={onUpdatePassword} className="max-w-2xl space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Current Password
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-10 transition-all border-primary/10"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    New Password
                  </label>
                  {newPassword && <span className="text-[9px] font-black uppercase tracking-widest text-primary">{strength.label}</span>}
                </div>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 transition-all border-primary/10"
                  required
                />
                {newPassword && (
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full ${strength.color} transition-all duration-500`}
                      style={{ width: strength.label === 'Strong' ? '100%' : strength.label === 'Medium' ? '66%' : '33%' }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 transition-all border-primary/10"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <Button type="submit" disabled={loading} className="gap-2 h-10 px-6 font-bold text-xs uppercase tracking-widest">
                <Lock size={14} />
                {loading ? 'Processing...' : 'Change Password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setMessage(null)
                }}
                className="h-10 text-xs font-bold uppercase tracking-widest"
              >
                Reset Form
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
