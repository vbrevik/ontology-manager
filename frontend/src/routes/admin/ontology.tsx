import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/ontology')({
    component: OntologyLayout,
})

function OntologyLayout() {
    return (
        <div className="h-[calc(100vh-65px)] overflow-hidden bg-background">
            <Outlet />
        </div>
    );
}
