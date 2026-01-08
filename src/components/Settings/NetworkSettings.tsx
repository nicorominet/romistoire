import React, { useEffect, useState } from 'react';
import { systemApi } from '@/api/system.api';
import { i18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogEntry, AccessLogFile, LogConfig } from '@/types/system.types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

/**
 * NetworkSettings Component
 * 
 * Displays system logs (Debug, Access, AI) and allows configuration of logging levels.
 * Uses systemApi for fetching logs and configuration.
 */
export const NetworkSettings = () => {
    const { t } = i18n;
    const [activeTab, setActiveTab] = useState("debug");
    
    // Debug Logs State
    const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
    const [loadingDebug, setLoadingDebug] = useState(false);

    // Access Logs State
    const [accessFiles, setAccessFiles] = useState<AccessLogFile[]>([]);
    const [selectedAccessFile, setSelectedAccessFile] = useState<string>("");
    const [accessLogs, setAccessLogs] = useState<LogEntry[]>([]);
    const [loadingAccess, setLoadingAccess] = useState(false);

    // AI Logs State
    const [aiFiles, setAiFiles] = useState<AccessLogFile[]>([]);
    const [selectedAiFile, setSelectedAiFile] = useState<string>("");
    const [aiLogs, setAiLogs] = useState<LogEntry[]>([]);
    const [loadingAi, setLoadingAi] = useState(false);

    // Config State
    // Default config, will be overwritten by API fetch
    const [config, setConfig] = useState<LogConfig>({
        enableSqlLogging: true,
        enableAccessLogging: true,
        minLevel: 'INFO'
    });

    // Effect to load data when tab changes
    useEffect(() => {
        if (activeTab === 'debug') loadDebugLogs();
        if (activeTab === 'access') loadAccessFiles();
        if (activeTab === 'ai') loadAiFiles();
        if (activeTab === 'settings') loadConfig();
    }, [activeTab]);

    // Effects to load file content when a file is selected
    useEffect(() => {
        if (selectedAccessFile) loadAccessLogContent(selectedAccessFile);
    }, [selectedAccessFile]);

    useEffect(() => {
        if (selectedAiFile) loadAiLogContent(selectedAiFile);
    }, [selectedAiFile]);

    // --- Actions ---

    /** Fetches debug logs from the server. */
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

    /** Fetches the list of access log files and filters them. */
    const loadAccessFiles = async () => {
        try {
            const files = await systemApi.getAccessLogFiles();
            // Robust check: if type is set use it, otherwise check filename pattern
            const accessOnly = files.filter((f) => f.type === 'access' || (!f.type && f.filename.startsWith('access-')));
            setAccessFiles(accessOnly);
            if (accessOnly.length > 0 && !selectedAccessFile) {
                setSelectedAccessFile(accessOnly[0].filename);
            }
        } catch (error) {
            console.error('Failed to load access files', error);
        }
    };

    /** Fetches the list of AI log files and filters them. */
    const loadAiFiles = async () => {
        try {
            const files = await systemApi.getAccessLogFiles();
            // Robust check
            const aiOnly = files.filter((f) => f.type === 'ai' || (!f.type && f.filename.startsWith('ai-')));
            setAiFiles(aiOnly);
            if (aiOnly.length > 0 && !selectedAiFile) {
                setSelectedAiFile(aiOnly[0].filename);
            }
        } catch (error) {
            console.error('Failed to load ai files', error);
        }
    };

    /** Fetches content of a specific access log file. */
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

    /** Fetches content of a specific AI log file. */
    const loadAiLogContent = async (filename: string) => {
        if (!filename) return;
        setLoadingAi(true);
        try {
            const entries = await systemApi.getAccessLogContent(filename);
            setAiLogs(entries);
        } catch (error) {
            console.error('Failed to load ai log content', error);
        } finally {
            setLoadingAi(false);
        }
    };

    /** Fetches current log configuration. */
    const loadConfig = async () => {
        try {
            const cfg = await systemApi.getLogConfig();
            if (cfg) setConfig(cfg);
        } catch (error) {
           console.error('Failed to load log config', error);
        }
    };

    /** 
     * Helper to determine badge color based on HTTP Method.
     */
    const getMethodColor = (method: string) => {
        switch (method) {
            case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'PUT': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    /** 
     * Helper to determine badge color based on HTTP Status Code.
     */
    const getStatusColor = (status: number) => {
        if (status >= 500) return 'bg-red-500';
        if (status >= 400) return 'bg-orange-500';
        if (status >= 300) return 'bg-blue-500';
        if (status >= 200) return 'bg-green-500';
        return 'bg-gray-500';
    };

    /** Update log configuration */
    const handleConfigChange = async (updates: Partial<LogConfig>) => {
        // Optimistic update
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        try {
            await systemApi.updateLogConfig(newConfig);
        } catch (error) {
            // Revert on error
            console.error('Failed to update config', error);
            loadConfig(); 
        }
    };

    return (
        <Card className="h-full border-0 shadow-none">
            <CardHeader className="pb-2">
                <CardTitle>{t('settings.networkTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* ... Tabs List ... */}
                     <div className="flex justify-between items-center mb-4">
                        <TabsList>
                            <TabsTrigger value="debug">{t('settings.network.tabs.debug')}</TabsTrigger>
                            <TabsTrigger value="access">{t('settings.network.tabs.access')}</TabsTrigger>
                            <TabsTrigger value="ai">{t('settings.network.tabs.ai')}</TabsTrigger>
                            <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4"/> {t('settings.network.tabs.config')}</TabsTrigger>
                        </TabsList>
                        {/* ... Action buttons ... */}
                        {activeTab === 'debug' && (
                             <Button variant="outline" size="sm" onClick={loadDebugLogs} disabled={loadingDebug} className="gap-2">
                                <RefreshCw className={`h-4 w-4 ${loadingDebug ? 'animate-spin' : ''}`} /> {t('settings.network.actions.refresh')}
                             </Button>
                        )}
                         {activeTab === 'access' && (
                             <Button variant="outline" size="sm" onClick={() => loadAccessLogContent(selectedAccessFile)} disabled={loadingAccess} className="gap-2">
                                <RefreshCw className={`h-4 w-4 ${loadingAccess ? 'animate-spin' : ''}`} /> {t('settings.network.actions.refresh')}
                             </Button>
                        )}
                        {activeTab === 'ai' && (
                             <Button variant="outline" size="sm" onClick={() => loadAiLogContent(selectedAiFile)} disabled={loadingAi} className="gap-2">
                                <RefreshCw className={`h-4 w-4 ${loadingAi ? 'animate-spin' : ''}`} /> {t('settings.network.actions.refresh')}
                             </Button>
                        )}
                    </div>

                    {/* ... Other Tabs Content ... */}
                    <TabsContent value="debug">
                    {/* ... */}
                        <Card>
                            <CardHeader className="py-4">
                                <CardTitle className="text-sm font-medium text-gray-500">
                                    {t('settings.network.debug.title')}
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
                                                    <TableHead className="w-[180px]">{t('settings.network.debug.table.time')}</TableHead>
                                                    <TableHead className="w-[100px]">{t('settings.network.debug.table.category')}</TableHead>
                                                    <TableHead>{t('settings.network.debug.table.message')}</TableHead>
                                                    <TableHead className="w-[80px]">{t('settings.network.debug.table.data')}</TableHead>
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

                    <TabsContent value="access">
                       {/* ... */}
                        <div className="mb-4">
                            <Select value={selectedAccessFile} onValueChange={setSelectedAccessFile}>
                                <SelectTrigger className="w-[250px]">
                                    <SelectValue placeholder={t('settings.network.access.selectFile')} />
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
                                                    <TableHead className="w-[100px]">{t('settings.network.access.table.method')}</TableHead>
                                                    <TableHead>{t('settings.network.access.table.path')}</TableHead>
                                                    <TableHead className="w-[80px]">{t('settings.network.access.table.status')}</TableHead>
                                                    <TableHead className="w-[80px]">{t('settings.network.access.table.time')}</TableHead>
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
                                                    <TableRow><TableCell colSpan={4} className="text-center py-8">{t('settings.network.access.noEntries')}</TableCell></TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                         </Card>
                    </TabsContent>

                    <TabsContent value="ai">
                        {/* ... */}
                         <div className="mb-4">
                            <Select value={selectedAiFile} onValueChange={setSelectedAiFile}>
                                <SelectTrigger className="w-[250px]">
                                    <SelectValue placeholder={t('settings.network.ai.selectFile')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {aiFiles.map(file => (
                                        <SelectItem key={file.filename} value={file.filename}>
                                            {file.date} ({Math.round(file.size / 1024)} KB)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                         <Card>
                            <CardContent className="pt-6">
                                {loadingAi ? (
                                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
                                ) : (
                                    <div className="h-[600px] overflow-auto border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[150px]">{t('settings.network.ai.table.time')}</TableHead>
                                                    <TableHead className="w-[100px]">{t('settings.network.ai.table.provider')}</TableHead>
                                                    <TableHead className="w-[100px]">{t('settings.network.ai.table.type')}</TableHead>
                                                    <TableHead>{t('settings.network.ai.table.details')}</TableHead>
                                                    <TableHead className="w-[80px]">{t('settings.network.ai.table.duration')}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {aiLogs.map((entry, i) => {
                                                    const meta = entry.meta || {};
                                                    return (
                                                    <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900 align-top">
                                                        <TableCell className="font-mono text-xs text-gray-500 whitespace-nowrap">
                                                            {new Date(entry.timestamp).toLocaleTimeString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="font-mono border-blue-500 text-blue-500">
                                                                {meta.provider}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={`${meta.success === false ? 'border-red-500 text-red-500' : 'border-green-500 text-green-500'}`}>
                                                                {meta.type}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs font-mono">
                                                            <details className="cursor-pointer group">
                                                                <summary className="font-semibold text-gray-700 dark:text-gray-300">
                                                                    {entry.message} {meta.error && <span className="text-red-500">- Error</span>}
                                                                </summary>
                                                                <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200">
                                                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                                                         <span className="text-gray-500">{t('settings.network.ai.details.input')}:</span>
                                                                         <pre className="whitespace-pre-wrap bg-gray-50 p-1 rounded max-h-[150px] overflow-y-auto w-full text-[10px]">{JSON.stringify(meta.input, null, 2)}</pre>
                                                                         
                                                                         <span className="text-gray-500">{t('settings.network.ai.details.output')}:</span>
                                                                         <pre className="whitespace-pre-wrap bg-gray-50 p-1 rounded max-h-[150px] overflow-y-auto w-full text-[10px]">{JSON.stringify(meta.output, null, 2)}</pre>
                                                                    </div>
                                                                </div>
                                                            </details>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-gray-500">{entry.duration}ms</TableCell>
                                                    </TableRow>
                                                    );
                                                })}
                                                {aiLogs.length === 0 && (
                                                    <TableRow><TableCell colSpan={5} className="text-center py-8">{t('settings.network.ai.noEntries')}</TableCell></TableRow>
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
                            <CardContent className="pt-6 space-y-4">
                               <div className="flex items-center justify-between">
                                    <Label htmlFor="sql-logging">{t('settings.network.config.sql')}</Label>
                                    <Switch 
                                        id="sql-logging"
                                        checked={config.enableSqlLogging} 
                                        onCheckedChange={(checked) => handleConfigChange({ enableSqlLogging: checked })}
                                    />
                               </div>
                               <div className="flex items-center justify-between">
                                    <Label htmlFor="access-logging">{t('settings.network.config.access')}</Label>
                                    <Switch 
                                        id="access-logging"
                                        checked={config.enableAccessLogging} 
                                        onCheckedChange={(checked) => handleConfigChange({ enableAccessLogging: checked })}
                                    />
                               </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};
