import { createFileRoute } from '@tanstack/react-router';
import { PlanEditor } from '@/features/targeting/components/PlanEditor';

export const Route = createFileRoute('/targeting/planning/$planId')({
    component: PlanEditorWrapper,
});

function PlanEditorWrapper() {
    const { planId } = Route.useParams();
    return <PlanEditor planId={planId} />;
}
