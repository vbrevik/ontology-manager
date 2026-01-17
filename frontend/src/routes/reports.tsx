import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Calendar, ExternalLink, Loader2 } from 'lucide-react'
import { fetchGeneratedReports, generateReport, type GeneratedReport } from '@/features/system/lib/api'

export const Route = createFileRoute('/reports')({
    component: ReportsPage,
})

function ReportsPage() {
    const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)

    const loadReports = async () => {
        setIsLoading(true)
        try {
            const data = await fetchGeneratedReports()
            setGeneratedReports(data)
        } catch (e) {
            console.error("Failed to load reports", e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadReports()
    }, [])

    const handleGenerateReport = async (type: string) => {
        setIsGenerating(true)
        try {
            await generateReport(type)
            // Optimistically add processing report or refresh
            await loadReports()
        } catch (e) {
            console.error("Failed to generate report", e)
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                    <p className="text-muted-foreground mt-1">
                        Generate and download audits, activity logs, and system summaries
                    </p>
                </div>
                {/* <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => handleGenerateReport('GENERAL')} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Generate New Report
                </Button> */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center text-indigo-700 dark:text-indigo-400">
                            <FileText className="mr-2 h-5 w-5" />
                            Access Audit
                        </CardTitle>
                        <CardDescription>Comprehensive report of user permissions and role changes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="outline"
                            className="w-full border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                            onClick={() => handleGenerateReport('ACCESS_AUDIT')}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Generate Audit'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center text-emerald-700 dark:text-emerald-400">
                            <Calendar className="mr-2 h-5 w-5" />
                            Activity Logs
                        </CardTitle>
                        <CardDescription>Detailed timeline of user actions and system events</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="outline"
                            className="w-full border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            onClick={() => handleGenerateReport('USER_ACTIVITY')}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Generate Log'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center text-amber-700 dark:text-amber-400">
                            <ExternalLink className="mr-2 h-5 w-5" />
                            System Health
                        </CardTitle>
                        <CardDescription>Performance metrics, errors, and uptime statistics</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="outline"
                            className="w-full border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            onClick={() => handleGenerateReport('SYSTEM_HEALTH')}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Generate Health Check'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-background/40">
                <CardHeader>
                    <CardTitle>Generated Reports</CardTitle>
                    <CardDescription>Recently generated reports available for download</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-6 text-muted-foreground">Loading reports...</div>
                        ) : generatedReports.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">No reports generated yet</div>
                        ) : (
                            generatedReports.map((report) => (
                                <div key={report.id} className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-muted rounded-lg">
                                            <FileText className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium">{report.name}</h4>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                <span>{new Date(report.generatedAt).toLocaleString()}</span>
                                                <span>•</span>
                                                <span>{report.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Badge
                                            variant={
                                                report.status === 'COMPLETED' ? 'default' :
                                                    report.status === 'PROCESSING' ? 'secondary' : 'destructive'
                                            }
                                            className={
                                                report.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25' : ''
                                            }
                                        >
                                            {report.status}
                                        </Badge>
                                        {report.status === 'COMPLETED' && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
