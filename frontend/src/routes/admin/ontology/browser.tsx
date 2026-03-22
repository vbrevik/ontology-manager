import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/ontology/browser')({
  component: OntologyBrowserPage,
})

function OntologyBrowserPage() {
  // Placeholder until Section 03 implements OntologyBrowser
  return <div>Ontology Browser</div>
}
