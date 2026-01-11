import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    FileText,
    Search,
    Filter,
    Download,
    RefreshCw,
    AlertCircle,
    Info,
    CheckCircle2,
    XCircle,
    AlertTriangle
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/logs')({
    component: LogsPage,
})

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success'

type LogEntry = {
    id: string
    timestamp: string
    level: LogLevel
    user?: string
    action: string
    resource?: string
    ip_address?: string
    details?: string
}

const MOCK_LOGS: LogEntry[] = [
    {
        id: '1',
        timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        level: 'success',
        user: 'alice@example.com',
        action: 'USER_LOGIN',
        ip_address: '192.168.1.100',
        details: 'Successful authentication'
    },
    {
        id: '2',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        level: 'info',
        user: 'bob@example.com',
        action: 'RESOURCE_ACCESS',
        resource: 'Document #123',
        details: 'Read access granted'
    },
    {
        id: '3',
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        level: 'warn',
        user: 'charlie@example.com',
        action: 'FAILED_PERMISSION_CHECK',
        resource: 'Admin Dashboard',
        details: 'Insufficient permissions'
    },
    {
        id: '4',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        level: 'error',
        action: 'SYSTEM_ERROR',
        details: 'Database connection timeout'
    },
    {
        id: '5',
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        level: 'debug',
        action: 'POLICY_EVALUATION',
        user: 'system',
        details: 'Policy check executed in 12ms'
    }
]

function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS)
    const [searchQuery, setSearchQuery] = useState('')
    const [levelFilter, setLevelFilter] = useState<string>('all')
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

    const getLevelIcon = (level: LogLevel) => {
        switch (level) {
            case 'success': return CheckCircle2
            case 'info': return Info
            case 'warn': return AlertTriangle
            case 'error': return XCircle
            case 'debug': return FileText
        }
    }

    const getLevelColor = (level: LogLevel) => {
        switch (level) {
            case 'success': return 'text-green-600 bg-green-500/10 border-green-500/20'
            case 'info': return 'text-blue-600 bg-blue-500/10 border-blue-500/20'
            case 'warn': return 'text-orange-600 bg-orange-500/10 border-orange-500/20'
            case 'error': return 'text-red-600 bg-red-500/10 border-red-500/20'
            case 'debug': return 'text-slate-600 bg-slate-500/10 border-slate-500/20'
        }
    }

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.user?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.details?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesLevel = levelFilter === 'all' || log.level === levelFilter
        return matchesSearch && matchesLevel
    })

    const handleRefresh = () => {
        // In real implementation, fetch fresh logs from API
        console.log('Refreshing logs...')
    }

    const handleExport = () => {
        // In real implementation, generate CSV/JSON export
        console.log('Exporting logs...')
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center">
                        <FileText className="mr-3 h-8 w-8 text-cyan-600" />
                        System Logs
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Audit trail and system event monitoring
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-border/40 bg-background/40">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <Search className="inline mr-1 h-3 w-3" />
                                Search
                            </Label>
                            <Input
                                placeholder="Search logs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <Filter className="inline mr-1 h-3 w-3" />
                                Log Level
                            </Label>
                            <Select value={levelFilter} onValueChange={setLevelFilter}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Levels</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="info">Info</SelectItem>
                                    <SelectItem value="warn">Warning</SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                    <SelectItem value="debug">Debug</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Badge variant="outline" className="h-9 px-4">
                                {filteredLogs.length} entries
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="border-border/40 bg-background/40">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-muted/40 border-b border-border/40">
                                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                    <th className="px-4 py-3 font-bold">Timestamp</th>
                                    <th className="px-4 py-3 font-bold">Level</th>
                                    <th className="px-4 py-3 font-bold">User</th>
                                    <th className="px-4 py-3 font-bold">Action</th>
                                    <th className="px-4 py-3 font-bold">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-muted-foreground italic text-sm">
                                            No logs match your filters
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => {
                                        const Icon = getLevelIcon(log.level)
                                        return (
                                            <tr
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                className={cn(
                                                    "hover:bg-muted/30 transition-colors cursor-pointer",
                                                    selectedLog?.id === log.id && "bg-primary/5"
                                                )}
                                            >
                                                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge className={cn("text-xs font-bold border", getLevelColor(log.level))}>
                                                        <Icon className="mr-1 h-3 w-3" />
                                                        {log.level.toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-sm">{log.user || '-'}</td>
                                                <td className="px-4 py-3 text-sm font-medium">{log.action}</td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-md">
                                                    {log.details || '-'}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Log Detail Slideout */}
            {selectedLog && (
                <Card className="border-border/40 bg-background/40 animate-in slide-in-from-bottom-4 duration-300">
                    <CardHeader className="border-b border-border/20">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center">
                                <AlertCircle className="mr-2 h-5 w-5 text-cyan-500" />
                                Log Details
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">ID</dt>
                                <dd className="font-mono">{selectedLog.id}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Timestamp</dt>
                                <dd className="font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Level</dt>
                                <dd>
                                    <Badge className={cn("text-xs font-bold border", getLevelColor(selectedLog.level))}>
                                        {selectedLog.level.toUpperCase()}
                                    </Badge>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">User</dt>
                                <dd>{selectedLog.user || 'System'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Action</dt>
                                <dd className="font-medium">{selectedLog.action}</dd>
                            </div>
                            {selectedLog.resource && (
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Resource</dt>
                                    <dd>{selectedLog.resource}</dd>
                                </div>
                            )}
                            {selectedLog.ip_address && (
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">IP Address</dt>
                                    <dd className="font-mono">{selectedLog.ip_address}</dd>
                                </div>
                            )}
                            {selectedLog.details && (
                                <div className="md:col-span-2">
                                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Details</dt>
                                    <dd className="bg-muted/30 p-3 rounded font-mono text-xs">{selectedLog.details}</dd>
                                </div>
                            )}
                        </dl>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

