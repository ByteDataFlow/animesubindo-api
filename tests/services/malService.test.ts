import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanTitle, cleanSlug, enrichAnimeListWithMal, enrichAnimeDetailWithMal, malCache } from '../../src/services/malService'

describe('MAL Service Suite', () => {
    beforeEach(async () => {
        await malCache.flushAll()
    })

    describe('cleanTitle', () => {
        it('should remove "Subtitle Indonesia" and similar tags', () => {
            expect(cleanTitle('One Piece Subtitle Indonesia')).toBe('One Piece')
            expect(cleanTitle('Horimiya: Piece Sub Indo')).toBe('Horimiya: Piece')
            expect(cleanTitle('Naruto Subtitle Indo')).toBe('Naruto')
        })

        it('should remove episode numbers and batch tags', () => {
            expect(cleanTitle('Boruto (Episode 1 – 150) Subtitle Indonesia')).toBe('Boruto')
            expect(cleanTitle('Bleach [Batch] Sub Indo')).toBe('Bleach')
            expect(cleanTitle('Attack on Titan Lengkap')).toBe('Attack on Titan')
        })

        it('should clean extra whitespace and dashes', () => {
            expect(cleanTitle('  One Piece   –  ')).toBe('One Piece')
        })
    })

    describe('cleanSlug', () => {
        it('should clean slug formatting and remove sub-indo suffix', () => {
            expect(cleanSlug('nigashita-sakana-sub-indo')).toBe('nigashita sakana')
            expect(cleanSlug('hyakkano-s3-sub-ind')).toBe('hyakkano s3')
            expect(cleanSlug('one-piece-episode-1000-sub-indo')).toBe('one piece')
        })
    })

    describe('enrichAnimeListWithMal & enrichAnimeDetailWithMal', () => {
        it('should return mal as null when VITEST env is active by default', async () => {
            const list = [{ title: 'One Piece Subtitle Indonesia', slug: 'one-piece', link: 'http://example.com' }]
            const result = await enrichAnimeListWithMal(list)
            expect(result[0]).toHaveProperty('mal', null)
        })

        it('should return null if detail item is null', async () => {
            const result = await enrichAnimeDetailWithMal(null)
            expect(result).toBeNull()
        })
    })
})
