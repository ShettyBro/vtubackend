// shared/logger/logger.ts
import { nowIST } from '../utils/time.js';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

function log(
  level: LogLevel,
  message: string,
  requestId?: string,
  metadata?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: nowIST(),
    requestId,
    metadata,
  };

  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, requestId?: string, metadata?: Record<string, unknown>) =>
    log(LogLevel.INFO, message, requestId, metadata),

  warn: (message: string, requestId?: string, metadata?: Record<string, unknown>) =>
    log(LogLevel.WARN, message, requestId, metadata),

  error: (message: string, requestId?: string, metadata?: Record<string, unknown>) =>
    log(LogLevel.ERROR, message, requestId, metadata),

  debug: (message: string, requestId?: string, metadata?: Record<string, unknown>) =>
    log(LogLevel.DEBUG, message, requestId, metadata),
};
