import NodeCache from 'node-cache'
import { Redis } from '@upstash/redis'

// Check for Upstash / Vercel KV credentials
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

let redisClient: Redis | null = null
if (redisUrl && redisToken) {
    try {
        redisClient = new Redis({ url: redisUrl, token: redisToken })
        console.log('⚡ [CacheService] Connected to Distributed Redis / Vercel KV')
    } catch (e) {
        console.warn('⚠️ [CacheService] Failed to initialize Redis client, falling back to in-memory NodeCache:', e)
    }
} else {
    if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ [CacheService] No Redis credentials found (KV_REST_API_URL / UPSTASH_REDIS_REST_URL). Using L1 local memory cache.')
    }
}

export class CacheInstance {
    private memoryCache: NodeCache
    private name: string

    constructor(name: string, defaultTTLSeconds: number = 300) {
        this.name = name
        this.memoryCache = new NodeCache({ stdTTL: defaultTTLSeconds, checkperiod: 600 })
    }

    /**
     * Get value from cache (Checks Redis first, fallback to in-memory)
     */
    async get<T>(key: string): Promise<T | undefined> {
        // Try L2 Distributed Cache (Redis) if enabled
        if (redisClient && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            try {
                const data = await redisClient.get<T>(key)
                if (data !== null && data !== undefined) {
                    // Update L1 local memory cache for subsequent faster hits
                    this.memoryCache.set(key, data, this.memoryCache.options.stdTTL || 300)
                    return data
                }
                return undefined
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Redis GET error for key "${key}", checking local RAM:`, error)
            }
        }
        // Fallback to L1 in-memory cache
        return this.memoryCache.get<T>(key)
    }

    /**
     * Set value in cache (Writes to both local in-memory and Redis)
     */
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        if (value === undefined) return
        const ex = ttlSeconds || this.memoryCache.options.stdTTL || 300
        
        // Save to L1 local RAM
        this.memoryCache.set(key, value, ex)

        // Save to L2 Distributed Redis
        if (redisClient && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            try {
                await redisClient.set(key, value, { ex })
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Redis SET error for key "${key}":`, error)
            }
        }
    }

    /**
     * Delete key from both local RAM and Redis
     */
    async del(key: string): Promise<void> {
        this.memoryCache.del(key)
        if (redisClient && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            try {
                await redisClient.del(key)
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Redis DEL error for key "${key}":`, error)
            }
        }
    }

    /**
     * Flush all cache entries
     */
    async flushAll(): Promise<void> {
        this.memoryCache.flushAll()
        if (redisClient && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            try {
                await redisClient.flushdb()
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Redis FLUSHDB error:`, error)
            }
        }
    }

    /**
     * Synchronous get helper for legacy or testing requirements
     */
    getSync<T>(key: string): T | undefined {
        return this.memoryCache.get<T>(key)
    }
}

// Export pre-configured cache instances
export const defaultCache = new CacheInstance('Default', 300) // 5 minutes default
export const malCacheInstance = new CacheInstance('MAL', 3600) // 1 hour default
