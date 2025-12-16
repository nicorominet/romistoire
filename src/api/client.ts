import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

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

client.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.error || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default client;
