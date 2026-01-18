import { createFileRoute } from '@tanstack/react-router'
import { ProjectList } from '@/features/projects'

export const Route = createFileRoute('/projects/')({
    component: ProjectsPage,
})

function ProjectsPage() {
    return <ProjectList />
}
