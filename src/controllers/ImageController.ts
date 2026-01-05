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
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    Referer: 'https://otakudesu.best/'
                }
            })

            const contentType = response.headers['content-type'] || 'image/jpeg'

            c.header('Content-Type', contentType)
            c.header('Cache-Control', 'public, max-age=86400')

            return stream(c, async (stream) => {
                const pipe = response.data.pipe(stream)
                await new Promise((resolve, reject) => {
                    pipe.on('finish', resolve)
                    pipe.on('error', reject)
                })
            })
        } catch (error: any) {
            // console.error('Image Proxy Error:', error.message)
            // Return placeholder or error
            throw new AppError('Failed to fetch image', 502, 'UPSTREAM_ERROR')
        }
    }
}
