import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../lib/logger';

// Define a custom interface where methods return T directly instead of AxiosResponse<T>
export interface AppClient extends AxiosInstance {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
}

const client = axios.create({
  baseURL: '/', // Relative path since we proxy or serve from same origin
  headers: {
    'Content-Type': 'application/json',
  },
}) as unknown as AppClient;

// Request Interceptor
client.interceptors.request.use((config) => {
    // Avoid logging log-sending requests to prevent infinite loops
    if (!config.url?.endsWith('/api/logs')) {
         // @ts-ignore
         config.metadata = { startTime: new Date().getTime() };
         logger.info('API_REQUEST', `Request: ${config.method?.toUpperCase()} ${config.url}`, {
            method: config.method,
            url: config.url,
            params: config.params,
            data: config.data
         });
    }
    return config;
});

// Response Interceptor
client.interceptors.response.use(
  (response) => {
    const config = response.config as any;
    if (!config.url?.endsWith('/api/logs')) {
        const duration = config.metadata ? new Date().getTime() - config.metadata.startTime : 0;
        logger.info('API_REQUEST', `Response: ${config.method?.toUpperCase()} ${config.url} (${response.status})`, {
            status: response.status,
            duration: `${duration}ms`,
            // Don't log full data if too large
        });
    }
    return response.data;
  },
  (error) => {
    const config = error.config as any;
    if (config && !config.url?.endsWith('/api/logs')) {
        const duration = config.metadata ? new Date().getTime() - config.metadata.startTime : 0;
        logger.error('API_REQUEST', `Error: ${config?.method?.toUpperCase()} ${config?.url}`, {
            status: error.response?.status,
            message: error.message,
            duration: `${duration}ms`,
            response: error.response?.data
        });
    }

    const message = error.response?.data?.error || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default client;
