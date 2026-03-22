import { Link, Outlet, useLocation } from '@tanstack/react-router';
import {
  Crosshair1Icon,
  FileTextIcon,
  GlobeIcon,
  TargetIcon,
  DashboardIcon
} from '@radix-ui/react-icons';

export function TargetingLayout() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500/30">
      {/* Sidebar Command Strip */}
      <aside className="w-16 flex flex-col items-center py-4 bg-slate-900 border-r border-slate-800 z-20">
        <div className="mb-8 p-2 rounded bg-orange-600/20 text-orange-500">
          <Crosshair1Icon className="w-6 h-6" />
        </div>

        <nav className="flex flex-col gap-4 w-full px-2">
          <NavIcon
            to="/targeting"
            icon={<DashboardIcon />}
            label="HQ Dashboard"
            active={location.pathname === '/targeting'}
          />
          <NavIcon
            to="/targeting/planning"
            icon={<FileTextIcon />}
            label="Planning (J5)"
            active={isActive('/targeting/planning')}
          />
          <NavIcon
            to="/targeting/ops"
            icon={<GlobeIcon />}
            label="Current Ops (J3)"
            active={isActive('/targeting/ops')}
          />
          <NavIcon
            to="/targeting/targets"
            icon={<TargetIcon />}
            label="Targeting (J2)"
            active={isActive('/targeting/targets')}
          />
        </nav>

        <div className="mt-auto flex flex-col gap-2 text-[10px] text-slate-500 font-mono text-center">
          <div>NATO</div>
          <div>SECRET</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Operational Header */}
        <header className="h-12 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between select-none">
          <div className="flex items-center gap-4">
            <h1 className="font-bold tracking-wider text-sm uppercase text-slate-400">
              Joint Targeting System
            </h1>
            <div className="h-4 w-px bg-slate-700 mx-2" />
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-emerald-500">● SYSTEM ONLINE</span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-500">DEFCON 3</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span>{new Date().toISOString().split('T')[0]}</span>
            <span className="text-orange-500 font-bold">ZULU</span>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950 relative">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavIcon({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      title={label}
      className={`
        w-10 h-10 rounded flex items-center justify-center transition-all duration-200
        ${active
          ? 'bg-orange-600/20 text-orange-500 border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
        }
      `}
    >
      <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full">
        {icon}
      </div>
    </Link>
  );
}
