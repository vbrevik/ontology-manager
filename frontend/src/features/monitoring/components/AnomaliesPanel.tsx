import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Anomaly {
  entity_id: string
  anomaly_type: string
  score: number
  description: string
  occurred_at: string
  attributes: Record<string, any>
}

interface Props {
  hours: number
}

export function AnomaliesPanel({ hours }: Props) {
  const { data: anomalies, isLoading } = useQuery({
    queryKey: ['monitoring', 'anomalies', hours],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/analytics/anomalies?hours=${hours}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch anomalies')
      return response.json() as Promise<Anomaly[]>
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  })

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Detecting anomalies...</div>
  }

  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50 text-green-500" />
        <p>No anomalies detected</p>
        <p className="text-xs mt-1">System behavior is normal</p>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 5) return 'text-destructive'
    if (score >= 2) return 'text-yellow-500'
    return 'text-blue-500'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 5) return 'destructive'
    if (score >= 2) return 'default'
    return 'secondary'
  }

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly) => (
        <div
          key={anomaly.entity_id}
          className="p-3 rounded-lg border bg-card"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${getScoreColor(anomaly.score)}`} />
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">
                  {anomaly.anomaly_type}
                </Badge>
                <Badge variant={getScoreBadge(anomaly.score)} className="text-xs">
                  Score: {anomaly.score.toFixed(1)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(anomaly.occurred_at), { addSuffix: true })}
                </span>
              </div>
              
              <p className="text-sm font-medium mb-2">{anomaly.description}</p>
              
              {anomaly.attributes.ip_address && (
                <p className="text-xs text-muted-foreground font-mono">
                  IP: {anomaly.attributes.ip_address}
                </p>
              )}
              
              {anomaly.attributes.attempt_count && (
                <p className="text-xs text-muted-foreground">
                  Attempts: {anomaly.attributes.attempt_count} in {anomaly.attributes.time_window_minutes} minutes
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
