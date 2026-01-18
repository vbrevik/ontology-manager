import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

interface UserActivity {
  user_id: string
  username: string | null
  email: string | null
  total_events: number
  failed_auths: number
  session_events: number
  api_requests: number
  data_accesses: number
  critical_events: number
  first_event: string
  last_event: string
}

interface Props {
  limit: number
}

export function UserActivityTable({ limit }: Props) {
  const { data: users, isLoading } = useQuery({
    queryKey: ['monitoring', 'user-activity', limit],
    queryFn: async () => {
      const response = await fetch(`/api/monitoring/analytics/user-activity?limit=${limit}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch user activity')
      return response.json() as Promise<UserActivity[]>
    },
    refetchInterval: 30000,
  })

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading user activity...</div>
  }

  if (!users || users.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No user activity data</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead className="text-right">Total Events</TableHead>
          <TableHead className="text-right">Failed Auth</TableHead>
          <TableHead className="text-right">Sessions</TableHead>
          <TableHead className="text-right">API Requests</TableHead>
          <TableHead className="text-right">Critical</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.user_id}>
            <TableCell>
              <div>
                <div className="font-medium">{user.username || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </TableCell>
            <TableCell className="text-right">{user.total_events}</TableCell>
            <TableCell className="text-right">
              {user.failed_auths > 0 ? (
                <Badge variant="destructive">{user.failed_auths}</Badge>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell className="text-right">{user.session_events}</TableCell>
            <TableCell className="text-right">{user.api_requests}</TableCell>
            <TableCell className="text-right">
              {user.critical_events > 0 ? (
                <div className="flex items-center justify-end gap-1">
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                  <span className="text-destructive font-medium">{user.critical_events}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
