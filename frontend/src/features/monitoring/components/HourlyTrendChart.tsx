import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format } from 'date-fns'

interface TrendPoint {
  timestamp: string
  value: number
}

interface Props {
  hours: number
  eventClass?: string
  title?: string
}

export function HourlyTrendChart({ hours, eventClass, title }: Props) {
  const { data: trend, isLoading } = useQuery({
    queryKey: ['monitoring', 'trend', eventClass, hours],
    queryFn: async () => {
      const url = eventClass
        ? `/api/monitoring/analytics/trend?event_class=${eventClass}&hours=${hours}&interval_minutes=60`
        : `/api/monitoring/analytics/hourly?hours=${hours}`
      
      const response = await fetch(url, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch trend')
      
      if (eventClass) {
        return response.json() as Promise<TrendPoint[]>
      } else {
        // Aggregate hourly stats
        const hourly = await response.json() as any[]
        const aggregated = new Map<string, number>()
        
        hourly.forEach((item) => {
          const hour = item.hour
          aggregated.set(hour, (aggregated.get(hour) || 0) + item.event_count)
        })
        
        return Array.from(aggregated.entries()).map(([timestamp, value]) => ({
          timestamp,
          value,
        }))
      }
    },
    refetchInterval: 30000,
  })

  if (isLoading || !trend || trend.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">
      Loading trend data...
    </div>
  }

  const data = trend.map((point) => ({
    time: format(new Date(point.timestamp), 'HH:mm'),
    events: point.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="time" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))', 
            border: '1px solid hsl(var(--border))' 
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="events"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6' }}
          name={title || 'Events'}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
