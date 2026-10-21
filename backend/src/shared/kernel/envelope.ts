import type { ErrorCode } from './errors';

// Response envelope from docs/08_API_Design.md.

export type ResponseMeta = {
  timestamp: string;
  requestId: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SuccessEnvelope<T> = {
  data: T;
  pagination?: Pagination;
  meta: ResponseMeta;
};

export type ErrorEnvelope = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  meta: ResponseMeta;
};

export function meta(requestId: string): ResponseMeta {
  return { timestamp: new Date().toISOString(), requestId };
}

// Marker for payloads that already carry pagination, so the interceptor
// lifts it to the envelope's top level instead of nesting it under `data`.
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly pagination: Pagination,
  ) {}
}
