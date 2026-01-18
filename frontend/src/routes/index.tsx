import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/lib/context'
import Dashboard from '@/features/dashboard/components/Dashboard'
import { OnboardingGuide } from '@/components/OnboardingGuide'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { MainSidebar } from '@/components/layout/MainSidebar'

export const Route = createFileRoute('/')({
  component: App,
})

function Landing() {
  return (
    <>
      {/* Hero Section */}
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 px-6 flex flex-col items-center text-center overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/10 rounded-full blur-3xl -z-10 opacity-50" />

        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-6">
          Ontology Manager v1.0
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 max-w-5xl leading-tight">
          Bridging Human Intent with <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
            AI Understanding
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mb-10 leading-relaxed">
          Ontologies: The Language of Machine Intelligence. <br />
          Structure Your Knowledge, Empower Your AI.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link to="/register" className="w-full sm:w-auto">
            <Button size="lg" className="h-12 w-full gap-2 text-base px-8 shadow-lg shadow-primary/20">
              Get Started <ArrowRight size={18} />
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="h-12 w-full text-base px-8">
              {/* The instruction implies adding OnboardingGuide here. */}
              {/* The provided snippet was syntactically incorrect, so I'm placing OnboardingGuide as a child */}
              {/* If you intended to replace "Explore Demo" with OnboardingGuide, please clarify. */}
              {/* If OnboardingGuide is meant to be a modal or overlay triggered by this button,
                  its implementation would be different (e.g., onClick handler). */}
              <OnboardingGuide /> {/* Added OnboardingGuide here */}
              Explore Demo {/* Keeping original text for now, adjust if OnboardingGuide should replace it */}
            </Button>
          </Link>
        </div>
      </section>


    </>
  )
}

function App() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background">Loading...</div>
  }

  // If user is authenticated, show the dashboard (header/sidebar are handled by root layout)
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-background">
        <MainSidebar />
        <div className="flex-1 flex flex-col">
          <Dashboard />
        </div>
      </div>
    )
  }

  // Public landing page without header/sidebar
  return <Landing />
}
