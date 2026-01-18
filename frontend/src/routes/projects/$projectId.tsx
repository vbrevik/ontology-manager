import { createFileRoute } from '@tanstack/react-router';
import { ProjectDetail } from '../../features/projects/components/ProjectDetail';

export const Route = createFileRoute('/projects/$projectId')({
    component: () => <ProjectDetail />,
});
