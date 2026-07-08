import { describe, it, expect, beforeEach } from 'vitest'
import { defaultCache, malCacheInstance } from '../../src/services/cacheService'

describe('CacheService Suite', () => {
    beforeEach(async () => {
        await defaultCache.flushAll()
        await malCacheInstance.flushAll()
    })

    it('should store and retrieve data from defaultCache', async () => {
        await defaultCache.set('test_key', { foo: 'bar' }, 60)
        const result = await defaultCache.get<{ foo: string }>('test_key')
        expect(result).toEqual({ foo: 'bar' })
    })

    it('should return undefined for non-existent keys', async () => {
        const result = await defaultCache.get('non_existent')
        expect(result).toBeUndefined()
    })

    it('should delete a key properly', async () => {
        await defaultCache.set('to_delete', 'value', 60)
        expect(await defaultCache.get('to_delete')).toBe('value')
        
        await defaultCache.del('to_delete')
        expect(await defaultCache.get('to_delete')).toBeUndefined()
    })

    it('should handle synchronous get helper getSync', async () => {
        await defaultCache.set('sync_key', 'sync_value', 60)
        expect(defaultCache.getSync('sync_key')).toBe('sync_value')
    })
})
