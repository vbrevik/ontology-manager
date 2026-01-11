import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Download,
    FileText,
    FileSpreadsheet,
    Calendar,
    Users,
    Activity,
    Shield,
    CheckCircle2,
    Clock
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/reports')({
    component: ReportsPage,
})

type ReportTemplate = {
    id: string
    name: string
    description: string
    icon: any
    category: 'users' | 'security' | 'performance'
    formats: string[]
}

type GeneratedReport = {
    id: string
    template: string
    format: string
    createdAt: string
    size: string
    status: 'ready' | 'pending' | 'failed'
}

const REPORT_TEMPLATES: ReportTemplate[] = [
    {
        id: 'user-activity',
        name: 'User Activity Report',
        description: 'Comprehensive breakdown of user logins, actions, and session data',
        icon: Users,
        category: 'users',
        formats: ['pdf', 'csv', 'json']
    },
    {
        id: 'access-audit',
        name: 'Access Audit Log',
        description: 'Detailed access control events, permission checks, and policy evaluations',
        icon: Shield,
        category: 'security',
        formats: ['pdf', 'csv']
    },
    {
        id: 'system-health',
        name: 'System Health Metrics',
        description: 'Performance indicators, API response times, and resource utilization',
        icon: Activity,
        category: 'performance',
        formats: ['pdf', 'csv', 'json']
    },
    {
        id: 'role-permissions',
        name: 'Role & Permission Matrix',
        description: 'Complete mapping of roles to permissions across all resources',
        icon: Shield,
        category: 'security',
        formats: ['pdf', 'csv']
    }
]

const MOCK_GENERATED: GeneratedReport[] = [
    {
        id: '1',
        template: 'User Activity Report',
        format: 'PDF',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        size: '2.4 MB',
        status: 'ready'
    },
    {
        id: '2',
        template: 'Access Audit Log',
        format: 'CSV',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        size: '856 KB',
        status: 'ready'
    },
    {
        id: '3',
        template: 'System Health Metrics',
        format: 'JSON',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        size: '1.2 MB',
        status: 'ready'
    }
]

function ReportsPage() {
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
    const [selectedFormat, setSelectedFormat] = useState<string>('pdf')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(MOCK_GENERATED)
    const [categoryFilter, setCategoryFilter] = useState<string>('all')

    const selectedTemplateData = REPORT_TEMPLATES.find(t => t.id === selectedTemplate)

    const filteredTemplates = REPORT_TEMPLATES.filter(t =>
        categoryFilter === 'all' || t.category === categoryFilter
    )

    const handleGenerate = async () => {
        setIsGenerating(true)
        // Simulate report generation
        await new Promise(resolve => setTimeout(resolve, 2000))

        const newReport: GeneratedReport = {
            id: String(generatedReports.length + 1),
            template: selectedTemplateData?.name || 'Report',
            format: selectedFormat.toUpperCase(),
            createdAt: new Date().toISOString(),
            size: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9)} MB`,
            status: 'ready'
        }

        setGeneratedReports([newReport, ...generatedReports])
        setIsGenerating(false)
    }

    const handleDownload = (reportId: string) => {
        console.log(`Downloading report: ${reportId}`)
    }

    const getFormatIcon = (format: string) => {
        switch (format.toLowerCase()) {
            case 'pdf': return FileText
            case 'csv': case 'json': return FileSpreadsheet
            default: return FileText
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center">
                        <Download className="mr-3 h-8 w-8 text-amber-600" />
                        Export Reports
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Generate comprehensive data exports and analytics reports
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Report Templates */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-border/40 bg-background/40">
                        <CardHeader className="border-b border-border/20">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Report Templates</CardTitle>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-48 h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        <SelectItem value="users">Users</SelectItem>
                                        <SelectItem value="security">Security</SelectItem>
                                        <SelectItem value="performance">Performance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-3">
                            {filteredTemplates.map((template) => {
                                const Icon = template.icon
                                const isSelected = selectedTemplate === template.id
                                return (
                                    <button
                                        key={template.id}
                                        onClick={() => setSelectedTemplate(template.id)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-xl border-2 transition-all",
                                            isSelected
                                                ? "border-amber-500 bg-amber-500/5 shadow-md"
                                                : "border-border/40 hover:border-amber-500/50 hover:bg-muted/30"
                                        )}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start space-x-4">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-lg flex items-center justify-center",
                                                    isSelected ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                                                )}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <h4 className="font-bold text-sm">{template.name}</h4>
                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                        {template.description}
                                                    </p>
                                                    <div className="flex items-center space-x-2 pt-2">
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                                            Formats:
                                                        </span>
                                                        {template.formats.map(format => (
                                                            <Badge key={format} variant="outline" className="text-[10px]">
                                                                {format.toUpperCase()}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 className="h-5 w-5 text-amber-500" />
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </CardContent>
                    </Card>

                    {/* Generated Reports History */}
                    <Card className="border-border/40 bg-background/40">
                        <CardHeader className="border-b border-border/20">
                            <CardTitle className="text-lg flex items-center">
                                <Clock className="mr-2 h-5 w-5 text-amber-500" />
                                Recent Reports
                            </CardTitle>
                            <CardDescription>Previously generated exports</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/40">
                                {generatedReports.map((report) => {
                                    const FormatIcon = getFormatIcon(report.format)
                                    return (
                                        <div key={report.id} className="p-4 hover:bg-muted/20 transition-colors flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                                    <FormatIcon className="h-5 w-5 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{report.template}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(report.createdAt).toLocaleString()} · {report.size}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <Badge variant="outline" className="text-xs">
                                                    {report.format}
                                                </Badge>
                                                <Button size="sm" variant="ghost" onClick={() => handleDownload(report.id)}>
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Generation Panel */}
                <div>
                    <Card className={cn(
                        "border-border/40 bg-background/40 sticky top-6",
                        !selectedTemplate && "opacity-60"
                    )}>
                        <CardHeader className="border-b border-border/20">
                            <CardTitle className="text-lg">Generate Report</CardTitle>
                            <CardDescription>Configure and export data</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {selectedTemplateData ? (
                                <>
                                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                        <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                                            Selected Template
                                        </p>
                                        <p className="text-sm font-medium">{selectedTemplateData.name}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Export Format
                                        </Label>
                                        <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedTemplateData.formats.map(format => (
                                                    <SelectItem key={format} value={format}>
                                                        {format.toUpperCase()}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Date Range
                                        </Label>
                                        <Select defaultValue="30d">
                                            <SelectTrigger className="h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="7d">Last 7 days</SelectItem>
                                                <SelectItem value="30d">Last 30 days</SelectItem>
                                                <SelectItem value="90d">Last 90 days</SelectItem>
                                                <SelectItem value="365d">Last year</SelectItem>
                                                <SelectItem value="all">All time</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="w-full h-11 bg-amber-600 hover:bg-amber-700"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Clock className="mr-2 h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                Generate Report
                                            </>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                    <FileText className="h-12 w-12 mb-3 opacity-20" />
                                    <p className="text-sm">Select a template to begin</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

