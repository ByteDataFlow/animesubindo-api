import { cors } from 'hono/cors'

/**
 * CORS Configuration
 * - Allows all origins by default (suitable for public API)
 * - For production, set ALLOWED_ORIGINS env var with comma-separated domains
 */
export const corsMiddleware = cors({
    origin: '*', // Public API - semua origin diizinkan
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86400 // 24 hours
})
