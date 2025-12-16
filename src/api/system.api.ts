import client from './client';

export const systemApi = {
  uploadImage: (formData: FormData) => client.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
  }),
  cleanupImages: () => client.delete('/api/cleanup-images'),
  resetData: () => client.delete('/api/reset-data'),
  // Import/Export often handled directly via fetch for Blobs or FormData simplicity, but we can wrap.
  importData: (formData: FormData) => client.post('/api/import-data', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
  }),
  exportData: () => client.get('/api/export-data', { responseType: 'blob' }),
  exportFull: () => client.get('/api/export-full', { responseType: 'blob' }),
  exportPdf: (options: any) => client.post('/api/export/pdf', options),
  
  getLogs: () => client.get<any[]>('/api/logs'),
  getLogDetails: (filename: string) => client.get<any[]>(`/api/logs/${filename}`),
  
  // New Endpoints
  getAccessLogFiles: () => client.get<any[]>('/api/logs/access/files'),
  getAccessLogContent: (filename: string) => client.get<any[]>(`/api/logs/access/${filename}`),
  
  getLogConfig: () => client.get<any>('/api/config/logs'),
  updateLogConfig: (config: any) => client.put('/api/config/logs', config),
};
