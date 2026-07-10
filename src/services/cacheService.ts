/* eslint-disable @typescript-eslint/no-explicit-any */
import NodeCache from 'node-cache'
import { Redis as UpstashRedis } from '@upstash/redis'
import { createClient } from 'redis'

// Check for Upstash / Vercel KV credentials (REST API)
const upstashUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const upstashToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

// Check for Vercel Marketplace standard Redis integration credentials (REDIS_URL / KV_URL)
const standardRedisUrl = process.env.REDIS_URL || process.env.KV_URL

let upstashClient: UpstashRedis | null = null
let nodeRedisClient: any = null

if (upstashUrl && upstashToken) {
    try {
        upstashClient = new UpstashRedis({ url: upstashUrl, token: upstashToken })
        console.log('⚡ [CacheService] Connected to Distributed Redis (Upstash REST API)')
    } catch (e) {
        console.warn('⚠️ [CacheService] Failed to initialize Upstash Redis client:', e)
    }
} else if (standardRedisUrl) {
    try {
        nodeRedisClient = createClient({ url: standardRedisUrl })
        nodeRedisClient.on('error', (err: any) => console.warn('⚠️ [CacheService] Node Redis Client Error:', err.message || err))
        console.log('⚡ [CacheService] Connected to Distributed Redis (REDIS_URL)')
    } catch (e) {
        console.warn('⚠️ [CacheService] Failed to initialize standard Node Redis client:', e)
    }
} else {
    if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ [CacheService] No Redis credentials found (REDIS_URL / KV_REST_API_URL / UPSTASH_REDIS_REST_URL). Using L1 local memory cache.')
    }
}

async function ensureNodeRedisConnected(): Promise<boolean> {
    if (!nodeRedisClient) return false
    if (nodeRedisClient.isOpen) return true
    try {
        await nodeRedisClient.connect()
        return true
    } catch (err) {
        console.warn('⚠️ [CacheService] Failed to connect nodeRedisClient:', err)
        return false
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
        if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
            return this.memoryCache.get<T>(key)
        }

        // 1. Try Upstash REST Redis
        if (upstashClient) {
            try {
                const data = await upstashClient.get<T>(key)
                if (data !== null && data !== undefined) {
                    this.memoryCache.set(key, data, this.memoryCache.options.stdTTL || 300)
                    return data
                }
                return undefined
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Upstash GET error for key "${key}":`, error)
            }
        }

        // 2. Try Standard Node Redis (REDIS_URL)
        if (nodeRedisClient) {
            try {
                const connected = await ensureNodeRedisConnected()
                if (connected) {
                    const raw = await nodeRedisClient.get(key)
                    if (raw !== null && raw !== undefined) {
                        try {
                            const parsed = JSON.parse(raw) as T
                            this.memoryCache.set(key, parsed, this.memoryCache.options.stdTTL || 300)
                            return parsed
                        } catch {
                            return raw as unknown as T
                        }
                    }
                    return undefined
                }
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Node Redis GET error for key "${key}":`, error)
            }
        }

        // 3. Fallback to L1 in-memory cache
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

        if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
            return
        }

        // Save to Upstash REST Redis
        if (upstashClient) {
            try {
                await upstashClient.set(key, value, { ex })
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Upstash SET error for key "${key}":`, error)
            }
        }

        // Save to Standard Node Redis (REDIS_URL)
        if (nodeRedisClient) {
            try {
                const connected = await ensureNodeRedisConnected()
                if (connected) {
                    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
                    await nodeRedisClient.set(key, serialized, { EX: ex })
                }
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Node Redis SET error for key "${key}":`, error)
            }
        }
    }

    /**
     * Delete key from both local RAM and Redis
     */
    async del(key: string): Promise<void> {
        this.memoryCache.del(key)
        if (process.env.NODE_ENV === 'test' || process.env.VITEST) return

        if (upstashClient) {
            try {
                await upstashClient.del(key)
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Upstash DEL error for key "${key}":`, error)
            }
        }
        if (nodeRedisClient) {
            try {
                const connected = await ensureNodeRedisConnected()
                if (connected) await nodeRedisClient.del(key)
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Node Redis DEL error for key "${key}":`, error)
            }
        }
    }

    /**
     * Flush all cache entries
     */
    async flushAll(): Promise<void> {
        this.memoryCache.flushAll()
        if (process.env.NODE_ENV === 'test' || process.env.VITEST) return

        if (upstashClient) {
            try {
                await upstashClient.flushdb()
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Upstash FLUSHDB error:`, error)
            }
        }
        if (nodeRedisClient) {
            try {
                const connected = await ensureNodeRedisConnected()
                if (connected) await nodeRedisClient.flushDb()
            } catch (error) {
                console.warn(`⚠️ [CacheService:${this.name}] Node Redis FLUSHDB error:`, error)
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
