import axios from 'axios'
import * as cheerio from 'cheerio'
import { malCacheInstance as malCache } from './cacheService'

export interface MalInfo {
    mal_id?: number
    score?: string
    synopsis?: string
    trailer_url?: string
    mal_url?: string
}

// Distributed Cache + In-Memory Cache with TTL 1 hour (3600 seconds)
export { malCache }

// Concurrency limiter for external MAL requests
let activeRequests = 0
const queue: (() => void)[] = []
const MAX_CONCURRENT_REQUESTS = 3

async function acquireToken(): Promise<void> {
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
        activeRequests++
        return
    }
    return new Promise<void>((resolve) => {
        queue.push(() => {
            activeRequests++
            resolve()
        })
    })
}

function releaseToken(): void {
    activeRequests--
    const next = queue.shift()
    if (next) next()
}

/**
 * Clean Otakudesu anime titles to get accurate search results on MyAnimeList
 */
export function cleanTitle(title: string): string {
    return title
        .replace(/\(Episode\s*\d+\s*[–-]\s*\d+\)/gi, '')
        .replace(/:\s*Episode\s*\d+.*$/gi, '')
        .replace(/\[?(Subtitle\s+Indonesia|Sub\s+Indo|Subtitle\s+Indo|Batch|Lengkap|End|Tamat|Ongoing)\]?/gi, '')
        .replace(/\[\s*\]/g, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s*[–-]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Clean Otakudesu anime slugs
 */
export function cleanSlug(slug?: string): string {
    if (!slug) return ''
    return slug
        .replace(/-(sub|subtitle).*$/i, '')
        .replace(/-episode-\d+.*$/i, '')
        .replace(/-(batch|lengkap|end|tamat|ongoing).*$/i, '')
        .replace(/-/g, ' ')
        .trim()
}

function removeSeasonTags(str: string): string {
    return str
        .replace(/\b(?:season|s|part|cour|stage)\s*\d+\b/gi, '')
        .replace(/\b\d+(st|nd|rd|th)\s+season\b/gi, '')
        .replace(/\s+\d+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function extractSeasonNumber(str: string): number | null {
    const m =
        str.match(/\b(?:season|s|part|cour|stage)\s*(\d+)\b/i) ||
        str.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/i) ||
        str.match(/\s(\d+)$/) ||
        str.match(/\s(II|III|IV|V)$/)
    if (m) {
        const val = m[1]
        if (val === 'II') return 2
        if (val === 'III') return 3
        if (val === 'IV') return 4
        if (val === 'V') return 5
        const n = parseInt(val, 10)
        if (!isNaN(n) && n > 1 && n < 20) return n
    }
    return null
}

async function searchMalOneQuery(
    query: string,
    cTitle: string,
    cSlug: string,
    targetSeason: number | null,
    signal: AbortSignal
): Promise<{ bestLink?: string; maxScore: number }> {
    if (!query) return { maxScore: -100 }
    const searchUrl = `https://myanimelist.net/anime.php?q=${encodeURIComponent(query)}&cat=anime`
    const searchRes = await axios.get(searchUrl, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        signal
    })

    const $search = cheerio.load(searchRes.data)
    const rows: { title: string; link: string; type: string }[] = []

    $search('div.js-categories-seasonal table tr').each((i, el) => {
        if (i > 0 && i <= 8) {
            const title = $search(el).find('strong').first().text().trim()
            const link =
                $search(el).find('a.hoverinfo_trigger[id^="sarea"]').attr('href') ||
                $search(el).find('a').attr('href') ||
                ''
            const type = $search(el).find('td').eq(2).text().trim()
            if (title && link) rows.push({ title, link, type })
        }
    })

    if (rows.length === 0) return { maxScore: -100 }

    let bestLink = rows[0].link
    let maxScore = -100
    const targetWords = [...new Set([...cTitle.toLowerCase().split(/\s+/), ...cSlug.toLowerCase().split(/\s+/)])].filter(
        (w) => w.length > 2
    )

    for (const row of rows) {
        if (
            row.type !== 'TV' &&
            row.type !== 'Movie' &&
            row.type !== 'ONA' &&
            row.type !== 'OVA' &&
            row.type !== 'Special'
        )
            continue
        let score = 0
        const rTitleLower = row.title.toLowerCase()
        const rowSeason = extractSeasonNumber(row.title)
        if (targetSeason !== null) {
            if (rowSeason === targetSeason) score += 12
            else if (rowSeason !== null && rowSeason !== targetSeason) score -= 6
            else if (targetSeason > 1 && rowSeason === null && !rTitleLower.includes(targetSeason.toString())) score -= 4
        } else {
            if (rowSeason !== null && rowSeason > 1) score -= 3
        }
        for (const w of targetWords) {
            if (rTitleLower.includes(w)) score += 3
        }
        if (rTitleLower === cTitle.toLowerCase() || rTitleLower === cSlug.toLowerCase()) score += 20
        if (score > maxScore) {
            maxScore = score
            bestLink = row.link
        }
    }
    return { bestLink, maxScore }
}

/**
 * Fetch anime info from MyAnimeList with timeout protection
 */
async function fetchMalInfoWithTimeout(
    cleanedTitle: string,
    timeoutMs: number = 8000,
    cleanedSlug: string = ''
): Promise<MalInfo | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const targetSeason = extractSeasonNumber(cleanedTitle) || extractSeasonNumber(cleanedSlug)
        const qTitle = removeSeasonTags(cleanedTitle)
        const qSlug = removeSeasonTags(cleanedSlug)

        let { bestLink, maxScore } = await searchMalOneQuery(
            qTitle,
            cleanedTitle,
            cleanedSlug,
            targetSeason,
            controller.signal
        )

        if ((maxScore <= 0 || !bestLink) && qSlug && qSlug !== qTitle) {
            const slugRes = await searchMalOneQuery(qSlug, cleanedTitle, cleanedSlug, targetSeason, controller.signal)
            if (slugRes.maxScore > maxScore && slugRes.bestLink) {
                bestLink = slugRes.bestLink
                maxScore = slugRes.maxScore
            }
        }

        if (!bestLink) return null

        // 2. Fetch Detail Page
        const detailRes = await axios.get(bestLink, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            signal: controller.signal
        })

        const $detail = cheerio.load(detailRes.data)

        // Extract mal_id from URL
        const idMatch = bestLink.match(/\/anime\/(\d+)/)
        const mal_id = idMatch ? parseInt(idMatch[1], 10) : undefined

        const scoreText = $detail('.fl-l.score .score-label').text().trim()
        const score = scoreText && scoreText !== 'N/A' ? scoreText : undefined

        let synopsis: string | undefined = $detail('[itemprop="description"]').text().trim()
        if (synopsis) {
            synopsis = synopsis.replace(/\r\n/g, '\n').replace(/\[Written by MAL Rewrite\]/gi, '').trim()
        } else {
            synopsis = undefined
        }

        let trailer_url =
            $detail('a.iframe.js-fancybox-video').attr('href') ||
            $detail('iframe[src*="youtube"]').attr('src') ||
            $detail('a[href*="youtube.com/watch"]').attr('href')

        if (trailer_url) {
            const match = trailer_url.match(/embed\/([a-zA-Z0-9_-]+)/)
            if (match && match[1]) {
                trailer_url = `https://www.youtube.com/watch?v=${match[1]}`
            }
        } else {
            trailer_url = undefined
        }

        return {
            mal_id,
            score,
            synopsis,
            trailer_url,
            mal_url: bestLink
        }
    } catch (_error) {
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}

/**
 * Get MAL Info for a title using cache and concurrency limiting
 */
export async function getMalInfoWithConcurrencyLimit(title: string, slug?: string): Promise<MalInfo | null> {
    const cleaned = cleanTitle(title)
    const cSlug = cleanSlug(slug)
    if (!cleaned && !cSlug) return null

    const cacheKey = cSlug ? `mal_${cleaned.toLowerCase()}_${cSlug.toLowerCase()}` : `mal_${cleaned.toLowerCase()}`
    const cached = await malCache.get<MalInfo | null>(cacheKey)
    if (cached !== undefined) return cached

    await acquireToken()
    try {
        const cachedAgain = await malCache.get<MalInfo | null>(cacheKey)
        if (cachedAgain !== undefined) return cachedAgain

        const malInfo = await fetchMalInfoWithTimeout(cleaned, 8000, cSlug)
        await malCache.set(cacheKey, malInfo || null, 3600) // TTL 1 hour (3600s)
        return malInfo || null
    } finally {
        releaseToken()
    }
}

/**
 * Enrich a list of scraped anime items with MAL info
 */
export async function enrichAnimeListWithMal<
    T extends { title: string; slug?: string; link?: string; mal?: MalInfo | null }
>(animeList: T[], force: boolean = false): Promise<T[]> {
    if (!force && (process.env.ENABLE_MAL_ENRICHMENT === 'false' || process.env.NODE_ENV === 'test' || process.env.VITEST)) {
        return animeList.map((item) => ({ ...item, mal: null }))
    }

    const enriched = await Promise.all(
        animeList.map(async (item) => {
            const slugStr = item.slug || (item.link ? item.link.split('/').filter(Boolean).pop() : '') || ''
            const mal = await getMalInfoWithConcurrencyLimit(item.title, slugStr)
            return { ...item, mal: mal || null }
        })
    )
    return enriched
}

/**
 * Enrich a single anime detail object with MAL info
 */
export async function enrichAnimeDetailWithMal<
    T extends { title: string; slug?: string; link?: string; mal?: MalInfo | null }
>(anime: T | null, force: boolean = false, slug?: string): Promise<T | null> {
    if (!anime) return null
    if (!force && (process.env.ENABLE_MAL_ENRICHMENT === 'false' || process.env.NODE_ENV === 'test' || process.env.VITEST)) {
        return { ...anime, mal: null }
    }

    const slugStr = slug || anime.slug || (anime.link ? anime.link.split('/').filter(Boolean).pop() : '') || ''
    const mal = await getMalInfoWithConcurrencyLimit(anime.title, slugStr)
    return { ...anime, mal: mal || null }
}
