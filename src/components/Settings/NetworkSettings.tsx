import React, { useEffect, useState } from 'react';
import { systemApi } from '@/api/system.api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { i18n } from '@/lib/i18n';

interface LogFile {
    filename: string;
    date: string;
    size: number;
}

interface LogEntry {
    timestamp: string;
    // Network Access Log Fields
    method?: string;
    url?: string;
    status?: number;
    duration?: number;
    ip?: string;
    // Application Log Fields
    type?: 'app';
    level?: string;
    message?: string;
    meta?: any;
}

export const NetworkSettings = () => {
    const { t } = i18n;
    const [logs, setLogs] = useState<LogFile[]>([]);
    const [selectedLog, setSelectedLog] = useState<string | null>(null);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadLogsList();
    }, []);

    useEffect(() => {
        if (selectedLog) {
            loadLogDetails(selectedLog);
        }
    }, [selectedLog]);

    const loadLogsList = async () => {
        try {
            const list = await systemApi.getLogs();
            setLogs(list);
            if (list.length > 0 && !selectedLog) {
                setSelectedLog(list[0].filename);
            }
        } catch (error) {
            console.error('Failed to load logs list', error);
        }
    };

    const loadLogDetails = async (filename: string) => {
        setLoading(true);
        try {
            const entries = await systemApi.getLogDetails(filename);
            setLogEntries(entries);
        } catch (error) {
            console.error('Failed to load log details', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: number) => {
        if (status >= 500) return 'bg-red-500';
        if (status >= 400) return 'bg-orange-500';
        if (status >= 300) return 'bg-blue-500';
        return 'bg-green-500';
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case 'GET': return 'bg-blue-100 text-blue-800';
            case 'POST': return 'bg-green-100 text-green-800';
            case 'PUT': return 'bg-orange-100 text-orange-800';
            case 'DELETE': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const requestLogs = logEntries.filter(l => l.type !== 'app');
    const averageDuration = requestLogs.length 
        ? (requestLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0) / requestLogs.length).toFixed(1)
        : 0;

    const errorCount = logEntries.filter(l => (l.status && l.status >= 400) || l.level === 'ERROR').length;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Select value={selectedLog || ''} onValueChange={setSelectedLog}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select date" />
                        </SelectTrigger>
                        <SelectContent>
                            {logs.map(log => (
                                <SelectItem key={log.filename} value={log.filename}>
                                    {log.date} ({Math.round(log.size / 1024)} KB)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <Badge variant="outline">Count: {logEntries.length}</Badge>
                        <Badge variant="outline">Avg Duration: {averageDuration}ms</Badge>
                        <Badge variant={errorCount > 0 ? "destructive" : "outline"}>Errors: {errorCount}</Badge>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>API Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="h-[600px] overflow-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Path</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>IP</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logEntries.map((entry, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50">
                                            <TableCell className="font-mono text-xs">
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                            </TableCell>
                                            <TableCell>
                                                {entry.type === 'app' ? (
                                                    <Badge variant="outline" className={`
                                                        ${entry.level === 'ERROR' ? 'border-red-500 text-red-500' : ''}
                                                        ${entry.level === 'WARN' ? 'border-orange-500 text-orange-500' : ''}
                                                        ${entry.level === 'INFO' ? 'border-blue-500 text-blue-500' : ''}
                                                    `}>
                                                        {entry.level}
                                                    </Badge>
                                                ) : (
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getMethodColor(entry.method || '')}`}>
                                                        {entry.method}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs max-w-[300px] truncate" title={entry.url || entry.message}>
                                                {entry.type === 'app' ? (
                                                    <span className={entry.level === 'ERROR' ? 'text-red-600 font-bold' : ''}>
                                                        {entry.message}
                                                    </span>
                                                ) : (
                                                    entry.url
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {entry.type === 'app' ? (
                                                    // Optional: Show meta if needed, or badging
                                                    entry.meta && Object.keys(entry.meta).length > 0 ? (
                                                        <Badge variant="secondary" className="text-[10px]">Meta</Badge>
                                                    ) : null
                                                ) : (
                                                    <Badge className={`${getStatusColor(entry.status || 0)} text-white border-0`}>
                                                        {entry.status}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {entry.type !== 'app' && (
                                                    <span className={(entry.duration || 0) > 1000 ? 'text-red-500 font-bold' : ''}>
                                                        {entry.duration}ms
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">{entry.ip}</TableCell>
                                        </TableRow>
                                    ))}
                                    {logEntries.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No logs found for this date.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
