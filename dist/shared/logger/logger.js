// shared/logger/logger.ts
import { nowIST } from '../utils/time.js';
export var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (LogLevel = {}));
function log(level, message, requestId, metadata) {
    const entry = {
        level,
        message,
        timestamp: nowIST(),
        requestId,
        metadata,
    };
    console.log(JSON.stringify(entry));
}
export const logger = {
    info: (message, requestId, metadata) => log(LogLevel.INFO, message, requestId, metadata),
    warn: (message, requestId, metadata) => log(LogLevel.WARN, message, requestId, metadata),
    error: (message, requestId, metadata) => log(LogLevel.ERROR, message, requestId, metadata),
    debug: (message, requestId, metadata) => log(LogLevel.DEBUG, message, requestId, metadata),
};
//# sourceMappingURL=logger.js.map