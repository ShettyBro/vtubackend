// shared/utils/requestId.ts
import { randomUUID } from 'crypto';

export function extractOrGenerateRequestId(headers: Record<string, string | undefined>): string {
  const requestId = headers['x-request-id'] || headers['X-Request-Id'];
  return requestId || randomUUID();
}