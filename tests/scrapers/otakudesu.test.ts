import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scrapeAnimeDetail, scrapeHome, scrapeSearch, scrapeEpisodeDetail } from '../../src/scrapers/otakudesu'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

// --- Mock Setup ---
vi.mock('axios')

const loadFixture = (filename: string) => {
    return fs.readFileSync(path.join(__dirname, '../fixtures', filename), 'utf-8')
}

describe('Otakudesu Scraper Suite', () => {

    beforeEach(() => {
        vi.resetAllMocks()
    })

    // --- Detail Page Tests ---
    describe('scrapeAnimeDetail', () => {
        it('should parse anime details correctly', async () => {
            const html = loadFixture('detail.html')
            vi.mocked(axios.get).mockResolvedValue({ data: html })

            const data = await scrapeAnimeDetail('one-piece-sub-indo')

            expect(data).not.toBeNull()
            expect(data?.title).toBe('One Piece')
            expect(data?.score).toBe('9.0')
            expect(data?.status).toBe('Ongoing')
            expect(data?.episodes).toHaveLength(2)
            expect(data?.episodes[0].title).toBe('Episode 1000')
        })

        it('should return null on 404/Network Error', async () => {
            vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'))
            const data = await scrapeAnimeDetail('unknown-slug')
            expect(data).toBeNull()
        })
    })

    // --- Home Page Tests ---
    describe('scrapeHome', () => {
        it('should separate ongoing and completed anime correctly', async () => {
            const html = loadFixture('home.html')
            vi.mocked(axios.get).mockResolvedValue({ data: html })

            const { ongoing, complete } = await scrapeHome()

            // Check Ongoing (Index 0)
            expect(ongoing).toHaveLength(1)
            expect(ongoing[0].title).toBe('One Piece')
            expect(ongoing[0].episode).toBe('Episode 1080')
            expect(ongoing[0].slug).toBe('one-piece-sub-indo')

            // Check Complete (Index 1)
            expect(complete).toHaveLength(1)
            expect(complete[0].title).toBe('Naruto Shippuden')
            // expect(complete[0].status).toBeUndefined() // Property does not exist on type
        })

        it('should return empty arrays on error', async () => {
            vi.mocked(axios.get).mockRejectedValue(new Error('Server Error'))
            const { ongoing, complete } = await scrapeHome()
            expect(ongoing).toEqual([])
            expect(complete).toEqual([])
        })
    })

    // --- Search Tests ---
    describe('scrapeSearch', () => {
        it('should scrape search results correctly', async () => {
            const fixture = fs.readFileSync(path.join(__dirname, '../fixtures/search.html'), 'utf-8')
            vi.mocked(axios.get).mockResolvedValue({ data: fixture })

            const results = await scrapeSearch('bleach')

            expect(results).toHaveLength(2)
            expect(results[0].title).toBe('Bleach')
            expect(results[0].slug).toBe('bleach-sub-indo')
            // Updated expectations based on new requirement
            expect(results[0].genres).toEqual(['Action', 'Shounen'])
            expect(results[0].status).toBe('Completed')
            expect(results[0].rating).toBe('8.5')
            expect(results[0].episode).toBeUndefined()
            expect(results[0].date).toBeUndefined()

            expect(results[1].title).toBe('Bleach: Sennen Kessen-hen')
            expect(results[1].genres).toEqual(['Action', 'Adventure'])
            expect(results[1].status).toBe('Ongoing')
            expect(results[1].rating).toBe('?') // From fixture
        })

        it('should handle empty search results gracefully', async () => {
            vi.mocked(axios.get).mockResolvedValue({ data: '<html><body><ul class="chivsrc"></ul></body></html>' })
            const results = await scrapeSearch('nothing')
            expect(results).toEqual([])
        })
    })

    // --- Episode Detail Tests ---
    describe('scrapeEpisodeDetail', () => {
        it('should extract stream and download links', async () => {
            const html = loadFixture('episode.html')
            vi.mocked(axios.get).mockResolvedValue({ data: html })

            const data = await scrapeEpisodeDetail('one-piece-episode-1080-sub-indo')

            expect(data).not.toBeNull()
            expect(data?.title).toContain('One Piece Episode 1080')
            expect(data?.streamUrl).toBe('https://desustream.com/embed/op-1080')

            // Mirror
            expect(data?.mirror_stream_url).toContain('https://mirror.com/op-1080')

            // Downloads
            expect(data?.download_links).toHaveLength(2)
            const lowRes = data?.download_links.find(d => d.resolution === '360p')
            expect(lowRes?.links).toHaveLength(2)
            expect(lowRes?.links[0].provider).toBe('Zippyshare')
        })
    })

})
