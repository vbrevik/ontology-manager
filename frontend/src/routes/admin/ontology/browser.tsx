import { createFileRoute } from '@tanstack/react-router'
import { OntologyBrowser } from '@/features/ontology/components/OntologyBrowser'

export const Route = createFileRoute('/admin/ontology/browser')({
  component: OntologyBrowserPage,
})

function OntologyBrowserPage() {
  return <OntologyBrowser />
}
