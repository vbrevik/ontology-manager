import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Shield, Users, ShieldAlert, Lock, Gauge, Network } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/access/')({
  component: AccessWorkspaceLanding,
})

const cards = [
  {
    title: 'Roles & Assignments',
    description: 'Manage role definitions and user assignments.',
    href: '/admin/access/Roles',
    icon: Users,
  },
  {
    title: 'Policy Playground',
    description: 'Test and validate policy behavior.',
    href: '/admin/access/policies',
    icon: ShieldAlert,
  },
  {
    title: 'Permissions',
    description: 'Review and audit permission definitions.',
    href: '/admin/access/Permissions',
    icon: Lock,
  },
  {
    title: 'Access Matrix',
    description: 'Visualize role-to-resource access.',
    href: '/admin/access/Matrix',
    icon: Gauge,
  },
  {
    title: 'Explorer',
    description: 'Browse effective access paths.',
    href: '/admin/access/explorer',
    icon: Network,
  },
]

function AccessWorkspaceLanding() {
  return (
    <div className="space-y-6">
      <Card className="border-indigo-200/60 bg-indigo-50/30">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-indigo-700">
              <Shield className="h-5 w-5" />
              Access Control Workspace
            </CardTitle>
            <CardDescription>
              Select a focus area to manage roles, permissions, or policies.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} to={card.href} className="group">
            <Card className="h-full transition-all group-hover:border-indigo-200 group-hover:shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <card.icon className="h-4 w-4 text-indigo-500" />
                  {card.title}
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className={cn("text-xs uppercase tracking-widest text-muted-foreground")}>
                  Open {card.title}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
