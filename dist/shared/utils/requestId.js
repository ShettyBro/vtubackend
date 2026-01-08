// shared/utils/requestId.ts
import { randomUUID } from 'crypto';
export function extractOrGenerateRequestId(headers) {
    const requestId = headers['x-request-id'] || headers['X-Request-Id'];
    return requestId || randomUUID();
}
//# sourceMappingURL=requestId.js.map