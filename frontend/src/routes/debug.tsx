import { createFileRoute } from '@tanstack/react-router'
import { DebugPage } from '@/features/debug/components/DebugPage'

export const Route = createFileRoute('/debug')({
    component: DebugPage,
})
