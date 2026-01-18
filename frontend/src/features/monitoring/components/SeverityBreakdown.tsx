import { useQuery } from '@tantml:react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  hours: number
}

export function SeverityBreakdown({ hours }: Props) {
  const { data: severity, isLoading } = useQuery({
    queryKey: ['monitoring', 'severity', hours],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/analytics/severity?hours=${hours}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch severity data')
      return response.json() as Promise<Record<string, number>>
    },
    refetchInterval: 30000,
  })

  if (isLoading || !severity) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">
      Loading severity data...
    </div>
  }

  const data = Object.entries(severity).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count,
  }))

  const getColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'critical':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      default:
        return '#3b82f6'
    }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="name" 
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
        <Bar dataKey="count" fill="#3b82f6">
          {data.map((entry, index) => (
            <Bar key={`bar-${index}`} fill={getColor(entry.name)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
