import { Link, useNavigate } from '@tanstack/react-router'
import { Terminal, LogOut, User, Sun, Moon, Flame } from 'lucide-react'
import { getFirefighterStatus, type FirefighterStatus } from '@/features/firefighter/lib/api'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/lib/context'
import Notifications from '@/components/Notifications'
import { useState, useEffect, useRef } from 'react'

export function Navbar() {
    const { isAuthenticated, logout, user, hasPermission } = useAuth()
    const navigate = useNavigate()
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    const [menuOpen, setMenuOpen] = useState(false)
    const [firefighterStatus, setFirefighterStatus] = useState<FirefighterStatus | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isAuthenticated) {
            getFirefighterStatus().then(setFirefighterStatus).catch(console.error);

            const interval = setInterval(() => {
                getFirefighterStatus().then(setFirefighterStatus).catch(console.error);
            }, 10000); // Poll every 10 seconds

            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const stored = localStorage.getItem('theme')
        if (stored === 'dark' || stored === 'light') {
            setTheme(stored)
            document.documentElement.classList.toggle('dark', stored === 'dark')
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark')
            document.documentElement.classList.add('dark')
        }
    }, [])

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        document.documentElement.classList.toggle('dark', next === 'dark')
        localStorage.setItem('theme', next)
    }

    const handleLogout = () => {
        logout()
        navigate({ to: '/' })
    }

    return (
        <header className="px-6 h-16 flex items-center justify-between border-b border-border/40 backdrop-blur-md sticky top-0 z-50 bg-background/80">
            <div className="flex items-center gap-2 font-bold text-xl">
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm group-hover:shadow-primary/20 group-hover:scale-105 transition-all">
                        <Terminal size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className="tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text leading-tight">Ontology manager</span>
                        <span className="text-[10px] text-muted-foreground font-normal leading-none">v{import.meta.env.PACKAGE_VERSION || '0.2.0'}</span>
                    </div>
                </Link>
                {firefighterStatus?.is_active && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider animate-pulse ml-2">
                        <Flame size={10} className="fill-orange-600/20" />
                        Firefighter Active
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                    className="rounded-full w-9 h-9 hover:bg-muted"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </Button>

                {isAuthenticated ? (
                    <div className="flex items-center gap-3">
                        <Notifications />
                        <div className="h-6 w-[1px] bg-border/60 mx-1 hidden sm:block" />
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="flex items-center gap-2 rounded-full border border-border/60 pl-1 pr-1.5 py-1 hover:bg-muted/50 transition-all active:scale-95"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-bold uppercase shadow-sm">
                                    {user?.username?.substring(0, 2) || 'U'}
                                </div>
                                <span className="hidden sm:inline font-medium text-sm pr-1">{user?.username}</span>
                            </button>

                            {menuOpen && (
                                <div className="absolute right-0 mt-3 w-60 rounded-xl border bg-popover p-2 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                                    <div className="px-3 py-2 border-b border-border/40 mb-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5 px-0.5">Account Info</p>
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-semibold truncate leading-none">{user?.username}</div>
                                        </div>
                                    </div>
                                    <div className="grid gap-1">
                                        <Link
                                            to="/profile"
                                            className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                                            onClick={() => setMenuOpen(false)}
                                        >
                                            <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                            Profile Settings
                                        </Link>
                                        {hasPermission('ui.view.dashboard') && (
                                            <Link
                                                to="/admin"
                                                className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                                                onClick={() => setMenuOpen(false)}
                                            >
                                                <Terminal className="mr-2 h-4 w-4 text-muted-foreground" />
                                                Administration
                                            </Link>
                                        )}
                                        <Link
                                            to="/debug"
                                            className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                                            onClick={() => setMenuOpen(false)}
                                        >
                                            <Terminal className="mr-2 h-4 w-4 text-muted-foreground" />
                                            Debug
                                        </Link>
                                    </div>
                                    <div className="h-px bg-border/40 my-2 mx-1" />
                                    <button
                                        className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 transition-colors"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link to="/login" className="hidden sm:block">
                            <Button variant="ghost" size="sm" className="font-medium">
                                Log in
                            </Button>
                        </Link>
                        <Link to="/register">
                            <Button size="sm" className="font-medium px-4 shadow-sm shadow-primary/20">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </header>
    )
}
