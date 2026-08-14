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
// VIDHIDE (odvidhide.com)
// The player JS is heavily obfuscated using Dean Edwards' Packer.
// We extract the eval() block, replace eval with a function that returns the
// unpacked string, and extract the authorized .m3u8 URL with its query params.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveVidhide(url: string): Promise<ResolvedStream | null> {
    const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 10000
    })

    const html: string = response.data

    // Find the packed script block
    // It looks like: eval(function(p,a,c,k,e,d)...)
    const scriptMatch = html.match(/(eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[rd]\s*\).*?)\s*<\/script>/is)
    
    if (!scriptMatch || !scriptMatch[1]) return null

    let packedCode = scriptMatch[1]
    
    // Convert the eval into a return statement to safely extract the unpacked string
    packedCode = packedCode.replace(/^eval/, 'return ')

    try {
        // Safely execute the unpacker logic within an isolated Function context
        const unpacker = new Function(packedCode)
        const unpacked: string = unpacker()

        // The unpacked string contains the constructed master.m3u8 URL with full auth tokens
        // Example: https://token.acek-cdn.com/hls2/01/08489/file_code/master.m3u8?t=...
        const m3u8Match = unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/)
        
        if (m3u8Match && m3u8Match[1]) {
            const m3u8Url = m3u8Match[1]
            
            // Try to verify - if HEAD fails, still return the URL
            try {
                await axios.head(m3u8Url, {
                    headers: { Referer: 'https://odvidhide.com/' },
                    timeout: 4000
                })
            } catch (_e) {
                // Ignore HEAD errors, let frontend try playing
            }

            return { url: m3u8Url, type: 'hls', mirror: 'vidhide' }
        }
    } catch (e: any) {
        console.error('[resolveVidhide] Unpack Error:', e.message)
    }

    return null
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER
// Detects provider from hostname and dispatches to the correct resolver.
// Returns null for unsupported mirrors (odstream, ondesuhd, blogger, etc.)
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

        // Unsupported mirror — caller should fall back to iframe embed
        return null
    } catch (error: any) {
        console.error('[resolveStream] Error:', error?.message)
        return null
    }
}
