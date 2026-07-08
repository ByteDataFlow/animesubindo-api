/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono'
import { z } from '@hono/zod-openapi'
import { defaultCache as cache } from '../services/cacheService'

// --- Cache Configuration ---
export { cache }

// --- Custom Error Class ---
export class AppError extends Error {
    statusCode: number
    code: string

    constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}

// --- Helper: Cache Wrapper ---
/**
 * Wraps an async function with caching logic.
 * @param key - The unique cache key.
 * @param fetchFunction - The function to fetch data if cache is missing.
 * @param ttl - Time-to-live in seconds.
 * @returns The cached or fetched data.
 */
export async function getCachedData<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number
): Promise<T> {
    const cached = await cache.get<T>(key)
    if (cached) return cached

    try {
        const data = await fetchFunction()
        // If data is null/undefined/empty array, we might still want to cache it or not depending on strategy.
        // For now, consistent with previous logic, we return it but don't cache if explicit null?
        // Original logic: if (!data) return data;
        if (!data) return data

        await cache.set(key, data, ttl)
        return data
    } catch (error: any) {
        console.error(`Cache fetch failed for ${key}:`, error)
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new AppError('Upstream Server Unreachable', 502, 'UPSTREAM_ERROR')
        }
        if (error.response?.status === 404) {
            throw new AppError('Resource Not Found Upstream', 404, 'UPSTREAM_NOT_FOUND')
        }
        throw new AppError(error.message || 'Internal Scraper Error', 500, 'SCRAPER_ERROR')
    }
}

// --- Global Error Handler ---
export const globalErrorHandler = (err: Error, c: Context) => {
    console.error('Global Error:', err)
    if (err instanceof AppError) {
        return c.json(
            {
                status: 'error',
                message: err.message,
                code: err.code
            },
            err.statusCode as any
        )
    }
    // Zod Validation Error (from Hono OpenAPI)
    if (err instanceof z.ZodError) {
        return c.json(
            {
                status: 'error',
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: err.flatten()
            },
            400
        )
    }
    return c.json(
        {
            status: 'error',
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR'
        },
        500
    )
}
