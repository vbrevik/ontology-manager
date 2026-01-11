import { createFileRoute } from '@tanstack/react-router'
import { AbacManagement } from '@/features/abac/components/AbacManagement'
import { useAbac } from '@/features/abac/lib/abac'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldAlert } from 'lucide-react'

export const Route = createFileRoute('/admin/abac')({
    component: AbacAdminRoute,
})

function AbacAdminRoute() {
    const { hasRole } = useAbac();
    const isAdmin = hasRole('superadmin') || hasRole('admin');

    if (!isAdmin) {
        return (
            <div className="p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to access the Access Control management system.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <AbacManagement />
        </div>
    );
}
