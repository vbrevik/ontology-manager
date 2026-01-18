import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TimelineEvent {
  id: string
  event_class: string
  display_name: string
  occurred_at: string
  severity: string
  attributes: Record<string, any>
  user_id?: string
}

export function EventTimeline() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['monitoring', 'timeline'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/analytics/timeline?limit=50&hours=24', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch timeline')
      return response.json() as Promise<TimelineEvent[]>
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading timeline...</div>
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No events in the last 24 hours</p>
      </div>
    )
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-destructive" />
      case 'warning':
        return <ShieldAlert className="w-4 h-4 text-yellow-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getSeverityVariant = (severity: string): 'destructive' | 'default' | 'secondary' => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'default'
      default:
        return 'secondary'
    }
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="mt-1">{getSeverityIcon(event.severity)}</div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {event.event_class}
                </Badge>
                <Badge variant={getSeverityVariant(event.severity)} className="text-xs">
                  {event.severity}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                </span>
              </div>
              
              <p className="text-sm font-medium">{event.display_name}</p>
              
              {event.attributes.ip_address && (
                <p className="text-xs text-muted-foreground">
                  IP: {event.attributes.ip_address}
                </p>
              )}
              
              {event.attributes.endpoint && (
                <p className="text-xs text-muted-foreground">
                  Endpoint: {event.attributes.endpoint}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
