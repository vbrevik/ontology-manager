import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/access')({
  component: AccessLayout,
})

function AccessLayout() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
        <Outlet />
      </div>
    </div>
  );
}
