import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { resolveStream } from '../../src/services/streamResolverService'

vi.mock('axios')

describe('StreamResolverService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Pixeldrain (pdrain)', () => {
        it('should resolve direct pixeldrain.com/u/{id} URL to api/file/{id}', async () => {
            const result = await resolveStream('https://pixeldrain.com/u/d9iWDUAH')

            expect(result).toEqual({
                url: 'https://pixeldrain.com/api/file/d9iWDUAH',
                type: 'mp4',
                mirror: 'pdrain'
            })
        })

        it('should resolve link.desustream.com redirecting to pixeldrain.com/u/{id}', async () => {
            vi.mocked(axios.get).mockResolvedValueOnce({
                status: 302,
                headers: {
                    location: 'https://pixeldrain.com/u/d9iWDUAH'
                },
                data: ''
            })

            const result = await resolveStream(
                'https://link.desustream.com/?id=d2JkL0hDRWxReWo4YUlhaDBYdk5ab1pJbEpWWVBKWmZTSEVuMkh5MnBvTG0='
            )

            expect(result).toEqual({
                url: 'https://pixeldrain.com/api/file/d9iWDUAH',
                type: 'mp4',
                mirror: 'pdrain'
            })
            expect(axios.get).toHaveBeenCalledWith(
                'https://link.desustream.com/?id=d2JkL0hDRWxReWo4YUlhaDBYdk5ab1pJbEpWWVBKWmZTSEVuMkh5MnBvTG0=',
                expect.objectContaining({
                    maxRedirects: 0,
                    headers: expect.objectContaining({
                        Referer: 'https://otakudesu.blog/'
                    })
                })
            )
        })
    })

    describe('Odstream (Archive.org)', () => {
        it('should resolve odstream archive.org links', async () => {
            vi.mocked(axios.get).mockResolvedValueOnce({
                status: 200,
                headers: {},
                data: '<html><script>file:"https://archive.org/download/anime-ep-1/video.mp4"</script></html>'
            })

            const result = await resolveStream('https://desustream.net/dstream/arcg/?id=test1234')

            expect(result).toEqual({
                url: 'https://archive.org/download/anime-ep-1/video.mp4',
                type: 'mp4',
                mirror: 'odstream'
            })
        })
    })

    describe('Unsupported & Vidhide', () => {
        it('should return null for vidhide (IP-locked)', async () => {
            const result = await resolveStream('https://odvidhide.com/embed/test123')
            expect(result).toBeNull()
        })

        it('should return null for unknown mirror domains', async () => {
            const result = await resolveStream('https://example.com/embed/123')
            expect(result).toBeNull()
        })
    })
})
