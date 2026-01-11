import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut, Terminal, ChevronDown } from 'lucide-react'
import { useAuth } from '@/features/auth/lib/context'
import { Link } from '@tanstack/react-router'

export function ProfileMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border/60 pl-1 pr-2 py-1 hover:bg-muted/50 transition-all active:scale-95"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-bold uppercase shadow-sm">
          {user?.username?.substring(0, 2) || 'U'}
        </div>
        <span className="hidden sm:inline font-medium text-sm pr-1">{user?.username || 'Account'}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-60 rounded-xl border bg-popover p-2 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="px-3 py-2 border-b border-border/40 mb-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5 px-0.5">Account Info</p>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold truncate leading-none">{user?.username}</div>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-1">{user?.email}</p>
          </div>
          <div className="grid gap-1">
            <Link
              to="/profile"
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              Profile Settings
            </Link>
            <Link
              to="/admin"
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              <Terminal className="mr-2 h-4 w-4 text-muted-foreground" />
              Administration
            </Link>
            <Link
              to="/debug"
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              <Terminal className="mr-2 h-4 w-4 text-muted-foreground" />
              Debug
            </Link>
          </div>
          <div className="h-px bg-border/40 my-2 mx-1" />
          <button
            className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 transition-colors"
            onClick={() => {
              logout()
              setOpen(false)
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
