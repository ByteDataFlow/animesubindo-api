import { rateLimiter } from 'hono-rate-limiter'

/**
 * Rate Limiter Configuration
 * - 100 requests per minute per client
 * - Applied only to /api/* routes
 */
export const apiRateLimiter = rateLimiter({
    windowMs: 60 * 1000, // 1 minute window
    limit: 100,          // Max 100 requests per window
    standardHeaders: 'draft-6',
    keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'anonymous'
})
