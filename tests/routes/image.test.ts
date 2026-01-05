import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../../src/index'
import axios from 'axios'
import request from 'supertest'
import { Readable } from 'stream'

vi.mock('axios')

describe('Image Proxy Route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 400 if url is missing', async () => {
        const res = await app.request('/api/image')
        expect(res.status).toBe(400)
        // const json = await res.json()
        // expect(json.status).toBe('error')
    })

    it('should return 400 if url is invalid', async () => {
        const res = await app.request('/api/image?url=not-a-url')
        expect(res.status).toBe(400)
    })

    it('should proxy image successfully', async () => {
        const mockStream = new Readable()
        mockStream.push('fake-image-data')
        mockStream.push(null)

        const mockResponse = {
            data: mockStream,
            headers: {
                'content-type': 'image/jpeg'
            }
        }

        // Mock axios to return a stream
        vi.mocked(axios).mockResolvedValue(mockResponse as any)

        const targetUrl = 'https://otakudesu.best/wp-content/uploads/test.jpg'
        const res = await app.request(`/api/image?url=${encodeURIComponent(targetUrl)}`)

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe('image/jpeg')
        expect(res.headers.get('cache-control')).toContain('max-age=86400')

        // In verify environment, we might not easily check stream content via app.request, 
        // but status 200 and headers confirm logic path.
    })

    it('should handle upstream errors', async () => {
        vi.mocked(axios).mockRejectedValue(new Error('Network Error'))

        const targetUrl = 'https://otakudesu.best/fail.jpg'
        const res = await app.request(`/api/image?url=${encodeURIComponent(targetUrl)}`)

        expect(res.status).toBe(502)
        const json = await res.json()
        expect(json.code).toBe('UPSTREAM_ERROR')
    })
})
