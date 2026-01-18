import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface IPReputation {
  ip_address: string
  event_class: string
  event_count: number
  first_seen: string
  last_seen: string
  severities: string[]
}

interface Props {
  limit: number
}

export function TopAttackingIPs({ limit }: Props) {
  const { data: ips, isLoading } = useQuery({
    queryKey: ['monitoring', 'top-ips', limit],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/analytics/top-ips?limit=${limit}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch top IPs')
      return response.json() as Promise<IPReputation[]>
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  })

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading IP data...</div>
  }

  if (!ips || ips.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No suspicious IPs detected</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {ips.map((ip) => (
        <div
          key={ip.ip_address}
          className="flex items-center justify-between p-3 rounded-lg border bg-card"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-medium">{ip.ip_address}</span>
              <Badge variant="destructive" className="text-xs">
                {ip.event_count} events
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{ip.event_class}</span>
              <span>•</span>
              <span>Last: {formatDistanceToNow(new Date(ip.last_seen), { addSuffix: true })}</span>
            </div>
            
            <div className="flex gap-1 mt-2">
              {ip.severities.map((severity) => (
                <Badge
                  key={severity}
                  variant={severity === 'critical' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {severity}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
