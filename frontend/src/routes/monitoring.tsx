import { createFileRoute } from '@tanstack/react-router'
import { MonitoringDashboard } from '@/features/monitoring/components/MonitoringDashboard'

export const Route = createFileRoute('/monitoring')({
  component: MonitoringPage,
})

function MonitoringPage() {
  return (
    <div className="container mx-auto py-6">
      <MonitoringDashboard />
    </div>
  )
}
