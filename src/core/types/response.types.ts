export interface ResponseError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ResponseEnvelope<T = unknown, M = Record<string, unknown>> {
  success: boolean;
  data?: T;
  meta?: M;
  error?: ResponseError;
}
