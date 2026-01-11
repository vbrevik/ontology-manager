import {
  Bell,
  CircleUser,
  Menu,
  Search,
  Sun,
  Moon,
  LayoutDashboard,
  Shield,
  Database,
  FileText,
  Settings,
  LogOut,
  User,
  Key,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useTheme } from '@/components/theme-provider'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/lib/context'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"

export function Header() {
  const { setTheme, theme } = useTheme()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [openKey, setOpenKey] = useState<string | null>(null)

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  const toggleOpen = (key: string) => {
    setOpenKey(openKey === key ? null : key)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[350px] pr-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-6 py-4 border-b">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">Ontology Manager</span>
              </div>
              <nav className="flex-1 overflow-auto py-6 px-4">
                <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>

                <div className="mt-6">
                  <h4 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Administration
                  </h4>
                  <div className="space-y-1">
                    <Collapsible open={openKey === 'access'} onOpenChange={() => toggleOpen('access')}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <Shield className="h-4 w-4" />
                          Access Control
                        </div>
                        <ChevronRight className={cn("h-4 w-4 transition-transform", openKey === 'access' && "rotate-90")} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-9 space-y-1 pt-1">
                        <Link to="/admin" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">Overview</Link>
                        <Link to="/admin/access/Roles" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">Roles & Assignments</Link>
                        <Link to="/admin/access/policies" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">Policy Playground</Link>
                        <Link to="/admin/access/explorer" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">Access Explorer</Link>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={openKey === 'ontology'} onOpenChange={() => toggleOpen('ontology')}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <Database className="h-4 w-4" />
                          Ontology
                        </div>
                        <ChevronRight className={cn("h-4 w-4 transition-transform", openKey === 'ontology' && "rotate-90")} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-9 space-y-1 pt-1">
                        <Link to="/admin/ontology" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">Overview</Link>
                        <Link to="/admin/ontology/versions" className="block px-3 py-2 rounded-md hover:bg-muted text-sm">Schema Versions</Link>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    System
                  </h4>
                  <div className="space-y-1">
                    <Link to="/logs" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      System Logs
                    </Link>
                    <Link to="/reports" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                      <Download className="h-4 w-4" />
                      Reports
                    </Link>
                    <Link to="/api-management" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium">
                      <Key className="h-4 w-4" />
                      API Management
                    </Link>
                  </div>
                </div>
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <Link to="/" className="flex items-center gap-2 mr-4 md:mr-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center hidden md:flex">
              <Database className="h-5 w-5 text-white" />
            </div>
            <span className="hidden md:inline font-bold text-indigo-900 dark:text-indigo-100">Ontology Manager</span>
          </Link>

          <form className="ml-auto flex-1 sm:flex-initial">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
              />
            </div>
          </form>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Toggle notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>No new notifications</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <CircleUser className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-500 hover:text-red-600 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
