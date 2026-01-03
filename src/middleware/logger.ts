import { logger } from 'hono/logger'

/**
 * Request Logger Middleware
 * Logs all incoming requests with method, path, and response time
 */
export const requestLogger = logger()
