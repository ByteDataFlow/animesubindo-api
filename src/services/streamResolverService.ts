import axios from 'axios'

export interface ResolvedStream {
    url: string
    type: 'mp4' | 'hls'
    mirror: string
}

const DEFAULT_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://otakudesu.blog/'
}

// ─────────────────────────────────────────────────────────────────────────────
// FILEDON
// HTML page has a data-page attribute containing HTML-encoded JSON.
// After html entity decoding, the JSON key "url" holds the R2 Cloudflare URL
// with escaped slashes: "url":"https:\/\/hash.r2.cloudflarestorage.com\/..."
// ─────────────────────────────────────────────────────────────────────────────
async function resolveFiledon(url: string): Promise<ResolvedStream | null> {
    const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 10000
    })

    const html: string = response.data

    // Decode HTML entities first (&quot; → ", &amp; → &, etc.)
    const decoded = html
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')

    // Match: "url":"https:\/\/hash.r2.cloudflarestorage.com\/..."
    // The URL in JSON has forward slashes escaped as \/ — use a safe regex
    const match = decoded.match(/"url":"(https:[^"]*r2\.cloudflarestorage[^"]+)"/)
    if (match && match[1]) {
        // Remove JSON slash escaping: \/ → /
        const cleanUrl = match[1].replace(/\\\//g, '/')
        return { url: cleanUrl, type: 'mp4', mirror: 'filedon' }
    }

    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// VIDHIDE (odvidhide.com)
// DISABLED: Vidhide uses strict IP-Locking on their CDN tokens (?t=...).
// Extracting the m3u8 token via the backend (e.g. Vercel IP) causes a 403 Forbidden
// when the frontend (User IP) tries to stream the video.
// Returns null so the frontend falls back to the standard iframe embed (Opsi A).
// ─────────────────────────────────────────────────────────────────────────────
async function resolveVidhide(_url: string): Promise<ResolvedStream | null> {
    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// ODSTREAM / DESUSTREAM (archive.org)
// Some desustream links (like Odstream) host their files on archive.org.
// These are NOT IP-Locked and can be safely extracted!
// ─────────────────────────────────────────────────────────────────────────────
async function resolveDesustreamArchive(url: string): Promise<ResolvedStream | null> {
    const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 10000
    })

    const html: string = response.data

    // Match: file:"https://archive.org/download/..."
    const match = html.match(/file\s*:\s*["'](https:\/\/archive\.org\/download\/[^"']+)["']/)
    if (match && match[1]) {
        return { url: match[1], type: 'mp4', mirror: 'odstream' }
    }

    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// PIXELDRAIN (pdrain)
// Supports direct pixeldrain URLs (/u/{id} or /api/file/{id})
// as well as Otakudesu link redirect URLs (link.desustream.com/?id=...)
// Returns direct stream: https://pixeldrain.com/api/file/{id} (CORS-enabled mp4)
// ─────────────────────────────────────────────────────────────────────────────
async function resolvePixeldrain(url: string): Promise<ResolvedStream | null> {
    try {
        let targetUrl = url

        // If it's a desustream redirect link, follow the 302 location header
        if (url.includes('link.desustream.com') || url.includes('desustream.net')) {
            const res = await axios.get(url, {
                headers: DEFAULT_HEADERS,
                maxRedirects: 0,
                timeout: 10000,
                validateStatus: (status) => status >= 200 && status < 400
            })
            const location = res.headers['location']
            if (location) {
                targetUrl = location
            }
        }

        const match = targetUrl.match(/pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/)
        if (match && match[1]) {
            return {
                url: `https://pixeldrain.com/api/file/${match[1]}`,
                type: 'mp4',
                mirror: 'pdrain'
            }
        }

        return null
    } catch (error: any) {
        console.error('[resolvePixeldrain] Error:', error?.message)
        return null
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER
// Detects provider from hostname and dispatches to the correct resolver.
// Returns null for unsupported mirrors (ondesuhd, blogger, etc.)
// — caller should fall back to iframe embed for those.
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveStream(embedUrl: string): Promise<ResolvedStream | null> {
    try {
        const hostname = new URL(embedUrl).hostname

        if (hostname.includes('filedon')) {
            return await resolveFiledon(embedUrl)
        }

        if (hostname.includes('vidhide') || hostname.includes('odvidhide')) {
            return await resolveVidhide(embedUrl)
        }

        if (hostname.includes('pixeldrain')) {
            return await resolvePixeldrain(embedUrl)
        }

        if (hostname.includes('desustream')) {
            // link.desustream.com is used for download link redirects (e.g. pdrain)
            if (embedUrl.includes('link.desustream.com')) {
                return await resolvePixeldrain(embedUrl)
            }

            // Odstream (archive.org) embed
            const archiveResult = await resolveDesustreamArchive(embedUrl)
            if (archiveResult) return archiveResult

            // Fallback: check if other desustream URLs redirect to pixeldrain
            return await resolvePixeldrain(embedUrl)
        }

        // Unsupported mirror — caller should fall back to iframe embed
        return null
    } catch (error: any) {
        console.error('[resolveStream] Error:', error?.message)
        return null
    }
}
