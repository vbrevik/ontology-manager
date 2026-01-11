import { createFileRoute } from '@tanstack/react-router'
import Placeholder from '@/components/Placeholder'
import { UserPlus } from 'lucide-react'

export const Route = createFileRoute('/admin/new')({
    component: () => (
        <Placeholder
            title="Create New User"
            description="The user creation management interface is currently under development. This feature will allow administrators to manually add and configure new user accounts."
            icon={UserPlus}
            color="from-indigo-500 to-purple-600"
        />
    ),
})
