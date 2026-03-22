import { createFileRoute } from '@tanstack/react-router'
import { OntologyBrowser } from '@/features/ontology/components/OntologyBrowser'

export const Route = createFileRoute('/ontology/')({
  component: OntologyPage,
})

function OntologyPage() {
  return <OntologyBrowser />
}
