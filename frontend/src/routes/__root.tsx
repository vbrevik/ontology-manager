import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { FirefighterBanner } from '@/components/firefighter/FirefighterBanner'
import { AuthProvider } from "@/features/auth/lib/context";
import { AiProvider } from "@/features/ai/lib/context";
import { ContextProvider } from "@/features/context/context-provider";

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <AiProvider>
        <ContextProvider>
          <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />
            <Breadcrumbs />
            <main className="flex-1">
              <Outlet />
            </main>
            <FirefighterBanner />
            <Footer />
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </div>
        </ContextProvider>
      </AiProvider>
    </AuthProvider>
  ),
})
