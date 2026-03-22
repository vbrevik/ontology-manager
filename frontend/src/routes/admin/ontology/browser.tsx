import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/ontology/browser')({
  beforeLoad: () => {
    throw redirect({ to: '/ontology' })
  },
})
