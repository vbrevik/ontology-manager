import { useQuery } from '@tanstack/react-query';
import { listProjects } from '@/features/projects/lib/api';
import { fetchEntities } from '@/features/ontology/lib/api';

export function useTargetingMetrics() {
    const projectsQuery = useQuery({
        queryKey: ['projects'],
        queryFn: () => listProjects(),
    });

    const targetsQuery = useQuery({
        queryKey: ['entities', 'total'],
        queryFn: () => fetchEntities(), // Fetches all entities for summary
    });

    // Calculate metrics
    const projects = projectsQuery.data?.projects || [];
    const activeOps = projects.filter(p => p.status === 'ACTIVE').length;
    const pendingOps = projects.filter(p => p.status === 'PENDING' || p.status === 'DRAFT').length;

    // For targets, we currently count ALL entities as "Potential Targets/Assets"
    // In a real system, we would filter by class_id or 'Target' type
    const totalTargets = targetsQuery.data?.length || 0;

    // Mock trend data (real implementation would need historical data)
    const newTargetsLast24h = 0;

    return {
        activeOps,
        pendingOps,
        totalTargets,
        newTargetsLast24h,
        isLoading: projectsQuery.isLoading || targetsQuery.isLoading,
        isError: projectsQuery.isError || targetsQuery.isError,
        refetch: () => {
            projectsQuery.refetch();
            targetsQuery.refetch();
        }
    };
}
