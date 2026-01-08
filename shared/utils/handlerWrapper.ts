// shared/utils/handlerWrapper.ts
import { extractOrGenerateRequestId } from './requestId.js';
import { handleError, getHttpStatus } from '../errors/errorHandler.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export function handlerWrapper(handler: Function) {
  return async (event: any) => {
    const requestId = extractOrGenerateRequestId(event.headers || {});

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: ''
      };
    }

    try {
      const response = await handler(event, { requestId });

      return {
        ...response,
        headers: {
          ...CORS_HEADERS,
          ...(response.headers || {})
        }
      };
    } catch (error) {
      const body = handleError(error, requestId);

      return {
        statusCode: getHttpStatus(error),
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      };
    }
  };
}
