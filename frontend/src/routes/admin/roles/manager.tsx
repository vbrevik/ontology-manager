import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/roles/manager')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/roles/manager"!</div>
}
