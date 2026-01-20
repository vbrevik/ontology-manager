import type { ReactNode } from 'react'
import { SystemStatusSidebar } from '@/components/layout/WorkspaceSidebars'

export function SystemStatusLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex bg-muted/10 min-h-screen">
      <SystemStatusSidebar />
      <div className="flex-1 min-h-[calc(100vh-4rem)]">
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
