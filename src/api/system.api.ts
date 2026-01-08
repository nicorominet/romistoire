import client from './client';
import { API_ENDPOINTS } from '../constants';
import { 
    LogEntry, 
    AccessLogFile, 
    CleanupResponse, 
    LogConfig 
} from '../types/system.types';

/**
 * API Client for System and Maintenance operations.
 * Handles uploads, data management, logs, and configuration.
 */
export const systemApi = {
  
  /**
   * Uploads an image file to the server.
   * @param {FormData} formData - Contains the 'file' to upload.
   * @returns {Promise<{ filename: string, path: string }>} Upload result.
   */
  uploadImage: (formData: FormData) => client.post(API_ENDPOINTS.UPLOAD, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
  }),

  /**
   * Removes unused images from the server storage.
   * @returns {Promise<CleanupResponse>} Result of the cleanup operation.
   */
  cleanupImages: () => client.delete<CleanupResponse>(API_ENDPOINTS.CLEANUP_IMAGES),

  /**
   * Resets the entire database to factory state (DESTRUCTIVE).
   * @returns {Promise<void>}
   */
  resetData: () => client.delete(API_ENDPOINTS.RESET_DATA),

  /**
   * Imports data from a JSON or ZIP backup.
   * @param {FormData} formData - Contains 'file' and 'mode' ('skip' | 'overwrite').
   * @returns {Promise<{ success: boolean, message: string }>} Import result.
   */
  importData: (formData: FormData) => client.post(API_ENDPOINTS.IMPORT_DATA, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
  }),

  /**
   * Exports data as a JSON file.
   * @returns {Promise<Blob>} Binary blob of the JSON file.
   */
  exportData: () => client.get(API_ENDPOINTS.EXPORT_DATA, { responseType: 'blob' }),

  /**
   * Exports full data including images as a ZIP archive.
   * @returns {Promise<Blob>} Binary blob of the ZIP file.
   */
  exportFull: () => client.get(API_ENDPOINTS.EXPORT_FULL, { responseType: 'blob' }),

  /**
   * Exports a story as PDF.
   * @param {any} options - PDF generation options.
   * @returns {Promise<Blob>} Binary blob of the PDF file.
   */
  exportPdf: (options: any) => client.post(API_ENDPOINTS.EXPORT_PDF, options, { responseType: 'blob' }),
  
  /**
   * Retrieves system debug logs.
   * @returns {Promise<LogEntry[]>} List of log entries.
   */
  getLogs: () => client.get<LogEntry[]>(API_ENDPOINTS.LOGS),

  /**
   * Retrieves specific log file details.
   * @param {string} filename - Name of the log file.
   * @returns {Promise<LogEntry[]>} List of log entries from the file.
   */
  getLogDetails: (filename: string) => client.get<LogEntry[]>(`${API_ENDPOINTS.LOGS}/${filename}`),
  
  /**
   * Retrieves list of available access log files.
   * @returns {Promise<AccessLogFile[]>} List of log files.
   */
  getAccessLogFiles: () => client.get<AccessLogFile[]>(API_ENDPOINTS.ACCESS_LOGS_FILES),

  /**
   * Retrieves content of a specific access log file.
   * @param {string} filename - Name of the file.
   * @returns {Promise<LogEntry[]>} Log entries parsed from the file.
   */
  getAccessLogContent: (filename: string) => client.get<LogEntry[]>(`${API_ENDPOINTS.ACCESS_LOGS_CONTENT}/${filename}`),
  
  /**
   * Retrieves current log configuration.
   * @returns {Promise<LogConfig>} Configuration object.
   */
  getLogConfig: () => client.get<LogConfig>(API_ENDPOINTS.CONFIG_LOGS),

  /**
   * Updates log configuration.
   * @param {LogConfig} config - New configuration.
   * @returns {Promise<LogConfig>} Updated configuration.
   */
  updateLogConfig: (config: LogConfig) => client.put<LogConfig>(API_ENDPOINTS.CONFIG_LOGS, config),
};
