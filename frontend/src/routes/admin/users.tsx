import { createFileRoute } from '@tanstack/react-router'
import UserManagement from '@/features/users/components/UserManagement'

export const Route = createFileRoute('/admin/users')({
    component: UserManagement,
})
