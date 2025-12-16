import React, { useEffect, useState } from 'react';
import { systemApi } from '@/api/system.api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Settings, FileText, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface LogEntry {
    timestamp: string;
    category?: string;
    level?: string;
    message?: string;
    data?: any;
    // Access Log specific
    method?: string;
    url?: string;
    status?: number;
    duration?: string | number;
    ip?: string;
    userAgent?: string;
}

interface AccessLogFile {
    filename: string;
    date: string;
    size: number;
}

interface LogConfig {
    enableSqlLogging: boolean;
    enableAccessLogging: boolean;
    minLevel: string;
}

export const NetworkSettings = () => {
    const [activeTab, setActiveTab] = useState("debug");
    
    // Debug Logs State
    const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
    const [loadingDebug, setLoadingDebug] = useState(false);

    // Access Logs State
    const [accessFiles, setAccessFiles] = useState<AccessLogFile[]>([]);
    const [selectedAccessFile, setSelectedAccessFile] = useState<string>("");
    const [accessLogs, setAccessLogs] = useState<LogEntry[]>([]);
    const [loadingAccess, setLoadingAccess] = useState(false);

    // Config State
    const [config, setConfig] = useState<LogConfig>({
        enableSqlLogging: true,
        enableAccessLogging: true,
        minLevel: 'INFO'
    });

    useEffect(() => {
        if (activeTab === 'debug') loadDebugLogs();
        if (activeTab === 'access') loadAccessFiles();
        if (activeTab === 'settings') loadConfig();
    }, [activeTab]);

    useEffect(() => {
        if (selectedAccessFile) loadAccessLogContent(selectedAccessFile);
    }, [selectedAccessFile]);

    // --- Actions ---

    const loadDebugLogs = async () => {
        setLoadingDebug(true);
        try {
            const entries = await systemApi.getLogs();
            setDebugLogs(entries);
        } catch (error) {
            console.error('Failed to load debug logs', error);
        } finally {
            setLoadingDebug(false);
        }
    };

    const loadAccessFiles = async () => {
        try {
            const files = await systemApi.getAccessLogFiles();
            setAccessFiles(files);
            if (files.length > 0 && !selectedAccessFile) {
                setSelectedAccessFile(files[0].filename);
            }
        } catch (error) {
            console.error('Failed to load access files', error);
        }
    };

    const loadAccessLogContent = async (filename: string) => {
        setLoadingAccess(true);
        try {
            const entries = await systemApi.getAccessLogContent(filename);
            setAccessLogs(entries);
        } catch (error) {
            console.error('Failed to load access log content', error);
        } finally {
            setLoadingAccess(false);
        }
    };

    const loadConfig = async () => {
        try {
            const cfg = await systemApi.getLogConfig();
            setConfig(cfg);
        } catch (error) {
            console.error('Failed to load config', error);
        }
    };

    const updateConfig = async (key: keyof LogConfig, value: any) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        try {
            await systemApi.updateLogConfig(newConfig);
        } catch (error) {
            console.error('Failed to update config', error);
        }
    };

    // --- Render Helpers ---

    const getStatusColor = (status: number) => {
        if (status >= 500) return 'bg-red-500';
        if (status >= 400) return 'bg-orange-500';
        if (status >= 300) return 'bg-blue-500';
        return 'bg-green-500';
    };

    const getMethodColor = (method: string) => {
        switch (method?.toUpperCase()) {
            case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'PUT': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="debug" className="gap-2"><Activity className="h-4 w-4"/> System Debug</TabsTrigger>
                        <TabsTrigger value="access" className="gap-2"><FileText className="h-4 w-4"/> Access Logs</TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4"/> Configuration</TabsTrigger>
                    </TabsList>

                    {activeTab === 'debug' && (
                         <Button variant="outline" size="sm" onClick={loadDebugLogs} disabled={loadingDebug} className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${loadingDebug ? 'animate-spin' : ''}`} /> Refresh
                         </Button>
                    )}
                     {activeTab === 'access' && (
                         <Button variant="outline" size="sm" onClick={() => loadAccessLogContent(selectedAccessFile)} disabled={loadingAccess} className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${loadingAccess ? 'animate-spin' : ''}`} /> Refresh
                         </Button>
                    )}
                </div>

                {/* --- DEBUG TAB --- */}
                <TabsContent value="debug">
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium text-gray-500">
                                Developer Logs (SQL, Interactions, Errors)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {loadingDebug && debugLogs.length === 0 ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
                             ) : (
                                <div className="h-[600px] overflow-auto border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[180px]">Time</TableHead>
                                                <TableHead className="w-[100px]">Category</TableHead>
                                                <TableHead>Message</TableHead>
                                                <TableHead className="w-[80px]">Data</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {debugLogs.map((entry, i) => (
                                                <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                                    <TableCell className="font-mono text-xs whitespace-nowrap text-gray-500">
                                                        {new Date(entry.timestamp).toLocaleTimeString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`
                                                            ${entry.level === 'ERROR' ? 'border-red-500 text-red-500' : ''}
                                                            ${entry.level === 'WARN' ? 'border-orange-500 text-orange-500' : ''}
                                                            ${entry.category === 'DB' ? 'border-purple-500 text-purple-500' : ''}
                                                        `}>
                                                            {entry.category || 'INFO'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        <span className={entry.level === 'ERROR' ? 'font-bold text-red-600' : ''}>
                                                            {entry.message}
                                                        </span>
                                                        {entry.category === 'DB' && entry.data?.sql && (
                                                            <div className="text-gray-400 mt-1 truncate max-w-[500px]">{entry.data.sql}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {entry.data?.duration && (
                                                             <span className="text-gray-500">{entry.data.duration}</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                             )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- ACCESS TAB --- */}
                <TabsContent value="access">
                     <div className="mb-4">
                        <Select value={selectedAccessFile} onValueChange={setSelectedAccessFile}>
                            <SelectTrigger className="w-[250px]">
                                <SelectValue placeholder="Select Log File" />
                            </SelectTrigger>
                            <SelectContent>
                                {accessFiles.map(file => (
                                    <SelectItem key={file.filename} value={file.filename}>
                                        {file.date} ({Math.round(file.size / 1024)} KB)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                     </div>
                     <Card>
                        <CardContent className="pt-6">
                            {loadingAccess ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
                            ) : (
                                <div className="h-[600px] overflow-auto border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">Method</TableHead>
                                                <TableHead>Path</TableHead>
                                                <TableHead className="w-[80px]">Status</TableHead>
                                                <TableHead className="w-[80px]">Time</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {accessLogs.map((entry, i) => (
                                                <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getMethodColor(entry.method || '')}`}>
                                                            {entry.method}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{entry.url}</TableCell>
                                                    <TableCell>
                                                        <Badge className={`${getStatusColor(entry.status || 0)} text-white border-0`}>
                                                            {entry.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-gray-500">{entry.duration}ms</TableCell>
                                                </TableRow>
                                            ))}
                                            {accessLogs.length === 0 && (
                                                <TableRow><TableCell colSpan={4} className="text-center py-8">No entries found.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                     </Card>
                </TabsContent>

                {/* --- CONFIG TAB --- */}
                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Logging Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">SQL Query Logging</Label>
                                    <div className="text-sm text-gray-500">
                                        Log every database query (can be verbose).
                                    </div>
                                </div>
                                <Switch 
                                    checked={config.enableSqlLogging}
                                    onCheckedChange={(c) => updateConfig('enableSqlLogging', c)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">HTTP Access Logging</Label>
                                    <div className="text-sm text-gray-500">
                                        Log incoming HTTP requests (Access Logs).
                                    </div>
                                </div>
                                <Switch 
                                    checked={config.enableAccessLogging}
                                    onCheckedChange={(c) => updateConfig('enableAccessLogging', c)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
