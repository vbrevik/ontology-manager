import { createFileRoute } from '@tanstack/react-router';
import { TargetingLayout } from '@/features/targeting/components/TargetingLayout';

export const Route = createFileRoute('/targeting')({
    component: TargetingLayout,
});
