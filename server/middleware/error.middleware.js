import { randomUUID } from 'crypto';

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

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Answer of an unexpected error (not an HttpError): the details stay in the server log, under an id
 * the user can give. SQL errors never reach the client (query, table names); in production
 * no raw message does.
 * @returns {{status: number, body: Object}}
 */
export const unexpectedErrorResponse = (error) => {
  const errorId = randomUUID().slice(0, 8);
  console.error(`Error ${errorId}:`, error);
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  // Errors of the HTTP layer (body too large, invalid JSON): their message is meant for the client
  if (status < 500 && error?.expose) return { status, body: { error: error.message, errorId } };
  if (error?.sqlMessage || error?.sql) return { status: 500, body: { error: 'Database error', errorId } };
  const message = isProduction() ? 'Internal server error' : (error?.message || 'Internal server error');
  return { status, body: { error: message, errorId } };
};

export const handleError = (res, error) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, ...(error.details || {}) });
  }
  const { status, body } = unexpectedErrorResponse(error);
  return res.status(status).json(body);
};

/** Last Express middleware: errors thrown outside the route handlers (JSON parser, multer...) answer in JSON. */
export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  handleError(res, error);
};
