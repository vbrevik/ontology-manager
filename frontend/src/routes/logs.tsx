import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, RefreshCw, AlertCircle, XCircle } from 'lucide-react'
import { fetchSystemLogs, type LogEntry } from '@/features/system/lib/api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/logs')({
    component: LogsPage,
})

function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

    const loadLogs = async () => {
        setIsLoading(true)
        try {
            const data = await fetchSystemLogs()
            setLogs(data)
        } catch (e) {
            console.error("Failed to load logs", e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadLogs()
    }, [])

    const filteredLogs = logs.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.level && log.level.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'INFO': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">INFO</Badge>
            case 'WARN': return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">WARN</Badge>
            case 'ERROR': return <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20">ERROR</Badge>
            case 'DEBUG': return <Badge variant="outline" className="text-muted-foreground">DEBUG</Badge>
            default: return <Badge variant="outline">{level}</Badge>
        }
    }

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'INFO': return 'text-blue-600 bg-blue-500/10 border-blue-500/20'
            case 'WARN': return 'text-amber-600 bg-amber-500/10 border-amber-500/20'
            case 'ERROR': return 'text-red-600 bg-red-500/10 border-red-500/20'
            case 'DEBUG': return 'text-slate-600 bg-slate-500/10 border-slate-500/20'
            default: return 'text-slate-600 bg-slate-500/10 border-slate-500/20'
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        View and analyze system events, errors, and audit trails
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            <Card className="border-border/40 bg-background/40 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Event Log</CardTitle>
                            <CardDescription>Recent system activities and alerts</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search logs..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-border/40">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-muted/50 border-border/40">
                                    <TableHead className="w-[180px]">Timestamp</TableHead>
                                    <TableHead className="w-[100px]">Level</TableHead>
                                    <TableHead className="w-[150px]">Source</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead className="w-[200px]">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Loading logs...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No logs found matching your criteria
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <TableRow
                                            key={log.id}
                                            className="hover:bg-muted/50 border-border/40 cursor-pointer"
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </TableCell>
                                            <TableCell>{getLevelBadge(log.level)}</TableCell>
                                            <TableCell className="font-medium text-xs">{log.source}</TableCell>
                                            <TableCell className="text-sm">{log.message}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={log.details}>
                                                {log.details || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Log Detail Slideout */}
            {selectedLog && (
                <Card className="fixed bottom-4 right-4 w-[500px] border-border/40 bg-background shadow-2xl animate-in slide-in-from-bottom-4 duration-300 z-50">
                    <CardHeader className="border-b border-border/20 py-4">
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
                                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Source</dt>
                                <dd className="font-medium">{selectedLog.source}</dd>
                            </div>
                            <div className="md:col-span-2">
                                <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Message</dt>
                                <dd className="font-medium">{selectedLog.message}</dd>
                            </div>
                            {selectedLog.details && (
                                <div className="md:col-span-2">
                                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Details</dt>
                                    <dd className="bg-muted/30 p-3 rounded font-mono text-xs overflow-x-auto whitespace-pre-wrap">{selectedLog.details}</dd>
                                </div>
                            )}
                        </dl>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
