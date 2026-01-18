import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface EventDistribution {
  event_class: string
  count: number
  percentage: number
}

interface Props {
  hours: number
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#f59e0b', // yellow
  '#10b981', // green
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

export function EventDistributionChart({ hours }: Props) {
  const { data: distribution, isLoading } = useQuery({
    queryKey: ['monitoring', 'distribution', hours],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/analytics/distribution?hours=${hours}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch distribution')
      return response.json() as Promise<EventDistribution[]>
    },
    refetchInterval: 30000,
  })

  if (isLoading || !distribution || distribution.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">
      Loading distribution...
    </div>
  }

  const data = distribution.map((item) => ({
    name: item.event_class,
    value: item.count,
    percentage: item.percentage,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => [value, 'Events']}
          contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
