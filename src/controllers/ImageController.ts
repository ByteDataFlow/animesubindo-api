/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '../lib/utils'
import axios from 'axios'
import { stream } from 'hono/streaming'

/**
 * Controller for Image Proxy
 */
export class ImageController {
    static proxyImage = async (c: any) => {
        const imageUrl = c.req.valid('query').url

        if (!imageUrl) {
            throw new AppError('Image URL is required', 400, 'BAD_REQUEST')
        }

        try {
            const response = await axios({
                method: 'get',
                url: imageUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Referer: 'https://otakudesu.best/',
                    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'same-origin'
                }
            })

            const contentType = response.headers['content-type'] || 'image/jpeg'

            c.header('Content-Type', contentType)
            c.header('Cache-Control', 'public, max-age=86400')

            return stream(c, async (stream) => {
                const dataStream = response.data
                // Manual piping to ensure compatibility with Hono stream helper
                for await (const chunk of dataStream) {
                    await stream.write(chunk)
                }
                await stream.close()
            })
        } catch (error: any) {
            console.error('Image Proxy Error:', error.message)
            throw new AppError('Failed to fetch image', 502, 'UPSTREAM_ERROR')
        }
    }
}
