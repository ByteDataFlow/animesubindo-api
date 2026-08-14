import { resolveStream } from '../services/streamResolverService'

export class StreamResolverController {
    static getResolveStream = async (c: any) => {
        try {
            const url = c.req.valid('query').url
            const result = await resolveStream(url)
            return c.json({ status: 'success', data: result })
        } catch (error: any) {
            console.error('StreamResolver Error:', error?.message)
            return c.json({ status: 'error', message: 'Failed to resolve stream' }, 500)
        }
    }
}
