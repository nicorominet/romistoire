
import React, { useEffect, useState, useRef } from 'react';
import { logger } from '@/lib/logger';
import { X, RefreshCw, Trash2, Filter, AlertTriangle, Info, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LogEntry {
    timestamp: string;
    level: string;
    category: string;
    message: string;
    data?: any;
}

const DebugConsole = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const response = await fetch('/api/logs?limit=100');
            const data = await response.json();
            if (Array.isArray(data)) {
                setLogs(data);
            }
        } catch (err) {
            console.error('Failed to fetch logs', err);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        fetchLogs();
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
    }, [isOpen]);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const filteredLogs = filterCategory 
        ? logs.filter(l => l.category === filterCategory) 
        : logs;

    const categories = Array.from(new Set(logs.map(l => l.category)));

    const getLevelColor = (level: string) => {
        switch (level?.toUpperCase()) {
            case 'ERROR': return 'text-red-500';
            case 'WARN': return 'text-yellow-500';
            default: return 'text-blue-500';
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level?.toUpperCase()) {
            case 'ERROR': return <Bug className="h-3 w-3" />;
            case 'WARN': return <AlertTriangle className="h-3 w-3" />;
            default: return <Info className="h-3 w-3" />;
        }
    };

    if (!isOpen) {
        return (
            <Button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 rounded-full h-10 w-10 p-0 shadow-lg bg-gray-900 text-white hover:bg-gray-800"
            >
                <Bug className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <div className="fixed bottom-0 right-0 w-full md:w-[600px] h-[50vh] bg-background border-t shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-2 border-b bg-muted/50">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Debug Console</span>
                    <Badge variant="outline" className="text-xs">{logs.length} logs</Badge>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchLogs}>
                        <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetch('/api/logs', { method: 'DELETE' }).then(fetchLogs)}>
                        <Trash2 className="h-3 w-3" />
                    </Button>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 p-2 border-b overflow-x-auto">
                <Badge 
                    variant={filterCategory === null ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setFilterCategory(null)}
                >
                    All
                </Badge>
                {categories.map(cat => (
                    <Badge 
                        key={cat}
                        variant={filterCategory === cat ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setFilterCategory(cat)}
                    >
                        {cat}
                    </Badge>
                ))}
            </div>

            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1 bg-black/5"
                onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    const isAtBottom = target.scrollHeight - target.scrollTop === target.clientHeight;
                    setAutoScroll(isAtBottom);
                }}
            >
                {filteredLogs.map((log, i) => (
                    <div key={i} className="flex gap-2 p-1 hover:bg-white/50 rounded group">
                        <span className="text-gray-400 shrink-0 w-16 text-[10px]">{log.timestamp.split('T')[1].split('.')[0]}</span>
                        <span className={`font-bold shrink-0 w-14 flex items-center gap-1 ${getLevelColor(log.level)}`}>
                            {getLevelIcon(log.level)}
                            {log.level}
                        </span>
                        <span className="font-semibold text-purple-600 shrink-0 w-24 truncate" title={log.category}>{log.category}</span>
                        <div className="break-all flex-1">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{log.message}</span>
                            {log.data && Object.keys(log.data).length > 0 && (
                                <pre className="mt-1 text-[10px] text-gray-500 bg-gray-100 p-1 rounded overflow-x-auto">
                                    {JSON.stringify(log.data, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DebugConsole;
