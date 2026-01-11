export interface LogEntry {
    id: string
    timestamp: string
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
    source: string
    message: string
    details?: string
}

export interface GeneratedReport {
    id: string
    name: string
    type: 'ACCESS_AUDIT' | 'USER_ACTIVITY' | 'SYSTEM_HEALTH'
    status: 'COMPLETED' | 'PROCESSING' | 'FAILED'
    generatedAt: string
    size: string
    downloadUrl: string
}

export async function fetchSystemLogs(): Promise<LogEntry[]> {
    const res = await fetch('/api/system/logs');
    if (!res.ok) throw new Error('Failed to fetch logs');
    const logs = await res.json();

    // Map backend AuditLog to frontend LogEntry
    return logs.map((log: any) => ({
        id: log.id,
        timestamp: log.created_at,
        level: 'INFO', // Audit logs are generally INFO
        source: log.target_type || 'System',
        message: log.action,
        details: log.metadata ? JSON.stringify(log.metadata) : undefined
    }));
}

export async function fetchGeneratedReports(): Promise<GeneratedReport[]> {
    const res = await fetch('/api/system/reports');
    if (!res.ok) throw new Error('Failed to fetch reports');
    const reports = await res.json();

    // Map backend GeneratedReport to frontend GeneratedReport
    return reports.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.report_type,
        status: r.status,
        generatedAt: r.generated_at,
        size: formatBytes(r.size_bytes), // Helper needed?
        downloadUrl: r.file_url || '#'
    }));
}

export async function generateReport(type: string): Promise<GeneratedReport> {
    const res = await fetch('/api/system/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: type })
    });
    if (!res.ok) throw new Error('Failed to generate report');
    const r = await res.json();
    return {
        id: r.id,
        name: r.name,
        type: r.report_type,
        status: r.status,
        generatedAt: r.generated_at,
        size: formatBytes(r.size_bytes),
        downloadUrl: r.file_url || '#'
    };
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
