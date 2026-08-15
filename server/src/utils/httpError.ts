/** Anwendungs-Fehler mit HTTP-Status und stabilem Fehlercode. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, 'bad_request', msg, details);

export const unauthorized = (msg = 'Nicht authentifiziert') =>
  new HttpError(401, 'unauthorized', msg);

export const forbidden = (msg = 'Kein Zugriff') =>
  new HttpError(403, 'forbidden', msg);

export const notFound = (msg = 'Nicht gefunden') =>
  new HttpError(404, 'not_found', msg);

export const conflict = (msg: string, details?: unknown) =>
  new HttpError(409, 'conflict', msg, details);

export const serviceUnavailable = (msg = 'Dienst nicht verfügbar') =>
  new HttpError(503, 'service_unavailable', msg);
