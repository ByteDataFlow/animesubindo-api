import axios from 'axios'

export class ProxyController {
    static getProxyStream = async (c: any) => {
        try {
            const url = c.req.valid('query').url

            // Validate that the URL belongs to allowed streaming domains to prevent SSRF
            const allowedDomains = [
                'desustream.net',
                'desustream.com',
                'desustream.me',
                'desustream.info',
                'filedon.co',
                'odvidhide.com',
                'mega.nz'
            ]
            const targetUrl = new URL(url)
            if (!allowedDomains.some((d) => targetUrl.hostname.includes(d))) {
                return c.json({ status: 'error', message: 'Domain not allowed for proxying' }, 403)
            }

            // Fetch the HTML from the target streaming site
            const response = await axios.get(url, {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Referer: 'https://otakudesu.blog/'
                }
            })

            let html = response.data

            // Inject <base href="..."> so relative scripts/css still work
            const baseTag = `<base href="${targetUrl.origin}/">`
            html = html.replace('<head>', `<head>\n    ${baseTag}`)

            return c.html(html)
        } catch (error: any) {
            console.error('Proxy Error:', error.message)
            return c.json({ status: 'error', message: 'Failed to proxy stream' }, 500)
        }
    }
}
