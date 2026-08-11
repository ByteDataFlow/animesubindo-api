import axios from 'axios'
import { malCacheInstance as malCache } from './cacheService'

export interface MalInfo {
    mal_id?: number
    score?: string
    synopsis?: string
    trailer_url?: string
    mal_url?: string
    rating?: string
    year?: number
    season?: string
}

// Distributed Cache + In-Memory Cache with TTL 24 hours (86400 seconds)
export { malCache }

// Concurrency limiter for external MAL requests
let activeRequests = 0
const queue: (() => void)[] = []
const MAX_CONCURRENT_REQUESTS = 1

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
    // 700ms delay before releasing the token to respect API rate limits (90/min)
    setTimeout(() => {
        activeRequests--
        const next = queue.shift()
        if (next) next()
    }, 700)
}

/**
 * Clean Otakudesu anime titles to get accurate search results
 */
export function cleanTitle(title: string): string {
    return title
        .replace(/\(Episode\s*\d+\s*[–-]\s*\d+\)/gi, '')
        .replace(/:\s*Episode\s*\d+.*$/gi, '')
        .replace(
            /\[?(Subtitle\s+Indonesia|Sub\s+Indo|Subtitle\s+Indo|Batch|Lengkap|End|Tamat|Ongoing)\]?/gi,
            ''
        )
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

/**
 * Strips HTML tags from a string
 */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, '').trim()
}

/**
 * Helper to query AniList GraphQL
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryAniList(searchQuery: string, controller: AbortController): Promise<any | null> {
    const graphqlQuery = `
        query ($search: String) {
            Page(page: 1, perPage: 1) {
                media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                    idMal
                    averageScore
                    description
                    trailer {
                        site
                        id
                    }
                    seasonYear
                    season
                    isAdult
                }
            }
        }
    `
    const response = await axios.post(
        'https://graphql.anilist.co',
        { query: graphqlQuery, variables: { search: searchQuery } },
        {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            signal: controller.signal
        }
    )
    const mediaList = response.data?.data?.Page?.media
    return mediaList && mediaList.length > 0 ? mediaList[0] : null
}

/**
 * Fetch anime info from AniList GraphQL API with timeout protection
 */
async function fetchMalInfoWithTimeout(
    cleanedTitle: string,
    timeoutMs: number = 8000,
    cleanedSlug: string = ''
): Promise<MalInfo | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const query = cleanedTitle || cleanedSlug
        if (!query) return null

        let media = await queryAniList(query, controller)

        // Fallback 1: Try shorter title (first 3 words)
        if (!media) {
            const words = query.split(/\s+/)
            if (words.length > 3) {
                const shortQuery = words.slice(0, 3).join(' ')
                media = await queryAniList(shortQuery, controller)
            }
        }

        // Fallback 2: Try slug if it's different
        if (!media && cleanedSlug && cleanedSlug !== query) {
            const slugWords = cleanedSlug.split(/\s+/)
            if (slugWords.length > 3) {
                const shortSlug = slugWords.slice(0, 3).join(' ')
                media = await queryAniList(shortSlug, controller)
            } else {
                media = await queryAniList(cleanedSlug, controller)
            }
        }

        if (!media) return null

        // Convert averageScore (1-100) to MAL format (1-10 string with 2 decimals)
        let scoreStr: string | undefined = undefined
        if (typeof media.averageScore === 'number') {
            scoreStr = (media.averageScore / 10).toFixed(2)
        }

        let synopsis = media.description ? stripHtml(media.description) : undefined
        if (synopsis) {
            synopsis = synopsis
                .replace(/\r\n/g, '\n')
                .replace(/\[Written by MAL Rewrite\]/gi, '')
                .trim()
        }

        let trailer_url: string | undefined = undefined
        if (media.trailer && media.trailer.site === 'youtube' && media.trailer.id) {
            trailer_url = `https://www.youtube.com/watch?v=${media.trailer.id}`
        }

        let ratingStr: string | undefined = undefined
        if (media.isAdult === true) ratingStr = 'Rx - Hentai'
        else if (media.isAdult === false) ratingStr = 'PG-13 or lower (estimated)'

        return {
            mal_id: media.idMal || undefined,
            score: scoreStr,
            synopsis: synopsis,
            trailer_url: trailer_url,
            mal_url: media.idMal ? `https://myanimelist.net/anime/${media.idMal}` : undefined,
            rating: ratingStr,
            year: media.seasonYear || undefined,
            season: media.season ? media.season.toLowerCase() : undefined
        }
    } catch (_error: any) {
        if (_error?.response?.status === 429) {
            console.error('Rate limited by AniList (429)!')
            throw _error
        }
        console.error('Error in fetchMalInfoWithTimeout (AniList):', _error?.message || _error)
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}

/**
 * Get MAL Info for a title using cache and concurrency limiting
 */
export async function getMalInfoWithConcurrencyLimit(
    title: string,
    slug?: string
): Promise<MalInfo | null> {
    const cleaned = cleanTitle(title)
    const cSlug = cleanSlug(slug)
    if (!cleaned && !cSlug) return null

    const cacheKey = cSlug
        ? `mal_${cleaned.toLowerCase()}_${cSlug.toLowerCase()}`
        : `mal_${cleaned.toLowerCase()}`
    const cached = await malCache.get<MalInfo | null>(cacheKey)
    if (cached !== undefined) return cached

    await acquireToken()
    try {
        const cachedAgain = await malCache.get<MalInfo | null>(cacheKey)
        if (cachedAgain !== undefined) return cachedAgain

        const malInfo = await fetchMalInfoWithTimeout(cleaned, 8000, cSlug)
        const ttl = malInfo ? 86400 : 3600 // 24 hours if data exists, only 1 hour if null
        await malCache.set(cacheKey, malInfo || null, ttl)
        return malInfo || null
    } catch (_error: any) {
        // If it's a rate limit error, do NOT cache the null result!
        // Just return null for this request so the frontend doesn't crash.
        return null
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
    if (
        !force &&
        (process.env.ENABLE_MAL_ENRICHMENT === 'false' ||
            process.env.NODE_ENV === 'test' ||
            process.env.VITEST)
    ) {
        return animeList.map((item) => ({ ...item, mal: null }))
    }

    const enriched = await Promise.all(
        animeList.map(async (item) => {
            const slugStr =
                item.slug || (item.link ? item.link.split('/').filter(Boolean).pop() : '') || ''
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
    if (
        !force &&
        (process.env.ENABLE_MAL_ENRICHMENT === 'false' ||
            process.env.NODE_ENV === 'test' ||
            process.env.VITEST)
    ) {
        return { ...anime, mal: null }
    }

    const slugStr =
        slug || anime.slug || (anime.link ? anime.link.split('/').filter(Boolean).pop() : '') || ''
    const mal = await getMalInfoWithConcurrencyLimit(anime.title, slugStr)
    return { ...anime, mal: mal || null }
}
