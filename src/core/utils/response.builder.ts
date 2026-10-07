import type { ResponseEnvelope } from "../types/response.types";

export class ResponseBuilder {
  static success<T, M = Record<string, unknown>>(data: T, meta?: M): ResponseEnvelope<T, M> {
    if (meta !== undefined) {
      return { success: true, data, meta };
    }
    return { success: true, data };
  }

  static created<T>(data: T): ResponseEnvelope<T> {
    return { success: true, data };
  }

  static noContent(): ResponseEnvelope {
    return { success: true };
  }

  static error(code: string, message: string, details?: unknown): ResponseEnvelope {
    if (details !== undefined) {
      return { success: false, error: { code, message, details } };
    }
    return { success: false, error: { code, message } };
  }
}
