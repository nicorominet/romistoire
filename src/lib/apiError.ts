/**
 * Reads an API error thrown by the axios client: HTTP status, JSON body and a displayable message.
 */
export const getApiError = <T extends Record<string, unknown> = Record<string, unknown>>(error: unknown) => {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  const data = (response?.data && typeof response.data === "object" ? response.data : {}) as T & { error?: string };
  return {
    status: response?.status,
    data,
    message: data.error || (error as Error)?.message || String(error),
  };
};
