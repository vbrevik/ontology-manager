import { createFileRoute } from '@tanstack/react-router'
import { OpsDashboard } from '@/features/operations/components/OpsDashboard'

export const Route = createFileRoute('/targeting/ops/')({
    component: OpsDashboard,
})
