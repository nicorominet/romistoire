/**
 * Error carrying an HTTP status and optional details for the client.
 */
export class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(message, details) { super(400, message, details); }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found', details) { super(404, message, details); }
}

export class ConflictError extends HttpError {
  constructor(message, details) { super(409, message, details); }
}

export const handleError = (res, error) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, ...(error.details || {}) });
  }
  console.error('Error:', error);
  if (error.sqlMessage) {
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
  return res.status(500).json({ error: error.message || 'Internal server error' });
};
