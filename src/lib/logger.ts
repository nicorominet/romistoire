
import axios from 'axios';

// Types
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type LogCategory = 
    | 'UI_INTERACTION' 
    | 'ROUTE_CHANGE' 
    | 'API_REQUEST' 
    | 'CLIENT_ERROR' 
    | 'SYSTEM_EVENT' 
    | 'PERFORMANCE';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    data?: any;
}

class LoggerService {
    private buffer: LogEntry[] = [];
    private flushInterval: number = 2000; // 2 seconds
    private intervalId: NodeJS.Timeout | null = null;
    private maxBufferSize = 50;

    constructor() {
        this.startFlushInterval();
        
        // Listen for visibility change to flush before tab close
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.flush();
                }
            });
        }
    }

    private startFlushInterval() {
        this.intervalId = setInterval(() => this.flush(), this.flushInterval);
    }

    public log(category: LogCategory, message: string, data?: any, level: LogLevel = 'INFO') {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            data
        };

        this.buffer.push(entry);

        // Immediate flush for errors or full buffer
        if (level === 'ERROR' || this.buffer.length >= this.maxBufferSize) {
            this.flush();
        }

        // Also log to console for local debugging
        if (process.env.NODE_ENV === 'development') {
            const style = level === 'ERROR' ? 'color: red' : level === 'WARN' ? 'color: orange' : 'color: blue';
            console.log(`%c[${category}] ${message}`, style, data || '');
        }
    }

    public info(category: LogCategory, message: string, data?: any) {
        this.log(category, message, data, 'INFO');
    }

    public warn(category: LogCategory, message: string, data?: any) {
        this.log(category, message, data, 'WARN');
    }

    public error(category: LogCategory, message: string, data?: any) {
        this.log(category, message, data, 'ERROR');
    }

    private async flush() {
        if (this.buffer.length === 0) return;

        const logsToSend = [...this.buffer];
        this.buffer = [];

        try {
            // Use axios directly to avoid circular dependency if we used our api client
            // And use a relative path assuming we are on same origin
            await axios.post('/api/logs', {
                category: 'BATCH_LOGS', // Just a wrapper category
                message: 'Batch of client logs',
                level: 'INFO',
                data: { logs: logsToSend } // Wrap logs in data object
            });
        } catch (err) {
            // Fallback: Retain logs if failed? Or just drop to avoid memory leak? 
            // For now, console error and drop.
            console.error('Failed to send logs to server', err);
        }
    }
}

export const logger = new LoggerService();
