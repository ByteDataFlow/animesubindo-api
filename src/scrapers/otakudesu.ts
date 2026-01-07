import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE_URL = 'https://otakudesu.best'

export interface ScrapedAnime {
    title: string
    slug: string
    link: string
    image?: string
    episode?: string
    date?: string
    genres?: string[]
    status?: string
    rating?: string
}

export interface ScrapedEpisode {
    title: string
    slug: string
    link: string
    date?: string
}

export interface ScrapedAnimeDetail {
    title: string
    japanese: string
    score: string
    producers: string
    type: string
    status: string
    total_episode: string
    duration: string
    synopsis: string
    image: string
    episodes: ScrapedEpisode[]
    batch_links: ScrapedEpisode[]
    lengkap_links: ScrapedEpisode[]
    genres?: { name: string; slug: string; link: string }[]
    release_date?: string
}

export interface ScrapedGenre {
    name: string
    link: string
    slug: string
}

export interface ScrapedAnimeList {
    title: string
    slug: string
    link: string
    status?: string
    type?: string
}

export interface ScrapedSchedule {
    day: string
    animeList: {
        title: string
        slug: string
        link: string
    }[]
}

export interface ScrapedLengkap {
    title: string
    japanese: string
    score: string
    producers: string
    type: string
    total_episode: string
    duration: string
    image: string
    release_date: string
    episodes: {
        title: string
        downloadUrls: { resolution: string; links: { provider: string; url: string }[] }[]
    }[]
    batch?: {
        title: string
        downloadUrls: { resolution: string; links: { provider: string; url: string }[] }[]
    }
}

export interface DownloadLink {
    provider: string
    url: string
}

export interface DownloadItem {
    resolution: string
    links: DownloadLink[]
}

export interface StreamSource {
    name: string
    url: string
}

export interface StreamMirror {
    quality: string
    sources: StreamSource[]
}

export interface ScrapedEpisodeDetail {
    title: string
    streamUrl: string
    streaming_mirrors: StreamMirror[]
    download_links: DownloadItem[]
    hasPrevEpisode: boolean
    prevEpisode: {
        title: string
        slug: string
        url: string
    } | null
    hasNextEpisode: boolean
    nextEpisode: {
        title: string
        slug: string
        url: string
    } | null
}

export interface ScrapedBatch {
    title: string
    downloadUrls: DownloadItem[]
    // Extended Metadata
    image?: string
    synopsis?: string
    japanese?: string
    score?: string
    producers?: string
    type?: string
    status?: string
    total_episode?: string
    duration?: string
    aired?: string
    studios?: string
    genres?: {
        title: string
        slug: string
        link: string
    }[]
}

export interface AjaxMirrorPayload {
    id: number
    i: number
    q: string
}

/**
 * Scrapes the home page for the latest ongoing and completed anime releases.
 *
 * @returns {Promise<{ ongoing: ScrapedAnime[], complete: ScrapedAnime[] }>} An object containing two arrays: `ongoing` and `complete`.
 */
export async function scrapeHome(): Promise<{ ongoing: ScrapedAnime[]; complete: ScrapedAnime[] }> {
    try {
        const { data } = await axios.get(BASE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const $ = cheerio.load(data)

        const ongoing: ScrapedAnime[] = []
        const complete: ScrapedAnime[] = []

        // Selecting all .venz containers
        // Typically: 0 -> On-going, 1 -> Complete
        $('.venz').each((index, container) => {
            const items: ScrapedAnime[] = []
            $(container)
                .find('.detpost')
                .each((i, el) => {
                    const title = $(el).find('.jdlflm').text().trim()
                    const link = $(el).find('.thumb a').attr('href')
                    const image = $(el).find('.thumb a img').attr('src')
                    const episode = $(el).find('.epz').text().trim()
                    const date = $(el).find('.newnime').text().trim()

                    let slug = ''
                    if (link) {
                        const parts = link.split('/')
                        slug = parts[parts.length - 2] || parts[parts.length - 1]
                    }

                    if (title && link) {
                        items.push({ title, slug, link, image, episode, date })
                    }
                })

            if (index === 0) {
                ongoing.push(...items)
            } else if (index === 1) {
                complete.push(...items)
            }
        })

        return { ongoing, complete }
    } catch (error) {
        console.error('Scraping Home Error:', error)
        return { ongoing: [], complete: [] }
    }
}

/**
 * Scrapes detailed information about a specific anime.
 *
 * @param {string} slug - The unique slug of the anime (e.g., 'one-piece-sub-indo').
 * @returns {Promise<ScrapedAnimeDetail | null>} Detailed anime metadata, or null if not found.
 */
export async function scrapeAnimeDetail(slug: string): Promise<ScrapedAnimeDetail | null> {
    try {
        let url = `${BASE_URL}/anime/${slug}/`
        let response
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try {
            response = await axios.get(url, { headers })
        } catch (_e) {
            /* Check fallback if failed */
        }


        let $ = cheerio.load(response ? response.data : '')

        // Fallback to /lengkap/ if standard fails or content not found
        if (!response || $('.fotoanime').length === 0) {
            const fallbackUrl = `${BASE_URL}/lengkap/${slug}/`
            try {
                response = await axios.get(fallbackUrl, { headers })
                $ = cheerio.load(response.data)
                url = fallbackUrl
            } catch (_err) {
                return null // Both URLs failed
            }
        }

        // Basic Info
        let title = $('.fotoanime .infozin .jdlflm').text().trim()
        if (!title) {
            // Try fallback selectors for /lengkap/ pages
            title = $('.jdlrx h1').text().trim() || $('.batchlink h4').text().trim()
        }

        const image = $('.fotoanime img').attr('src') || $('.separator img').attr('src') || ''
        const synopsis = $('.sinopc').text().trim()
        let score = $('.fotoanime .infozin .total skor').text().trim()

        // Detailed Metadata extraction
        let japanese = ''
        let producers = ''
        let type = ''
        let status = ''
        let total_episode = ''
        let duration = ''
        let release_date = ''
        const genres: { name: string; slug: string; link: string }[] = []

        // Parsing Strategy 1: .infos (common on /lengkap/ or completed pages)
        const infoHtml = $('.infos').html()
        if (infoHtml) {
            const lines = infoHtml.split('<br>')
            lines.forEach((line) => {
                const cleanLine = line.replace(/<[^>]*>/g, '').trim()
                if (cleanLine.includes('Japanese:'))
                    japanese = cleanLine.replace('Japanese:', '').trim()
                else if (cleanLine.includes('Skor:')) score = cleanLine.replace('Skor:', '').trim()
                else if (cleanLine.includes('Produser:'))
                    producers = cleanLine.replace('Produser:', '').trim()
                else if (cleanLine.includes('Tipe:')) type = cleanLine.replace('Tipe:', '').trim()
                else if (cleanLine.includes('Status:'))
                    status = cleanLine.replace('Status:', '').trim()
                else if (cleanLine.includes('Total Episode:'))
                    total_episode = cleanLine.replace('Total Episode:', '').trim()
                else if (cleanLine.includes('Durasi:'))
                    duration = cleanLine.replace('Durasi:', '').trim()
                else if (cleanLine.includes('Tanggal Rilis:') || cleanLine.includes('Aired:'))
                    release_date = cleanLine
                        .replace('Tanggal Rilis:', '')
                        .replace('Aired:', '')
                        .trim()
            })
            // Extract genres from .infos
            $('.infos a').each((i, el) => {
                const href = $(el).attr('href')
                if (href && href.includes('/genres/')) {
                    const name = $(el).text().trim()
                    const parts = href.split('/')
                    const genreSlug = parts[parts.length - 2] || parts[parts.length - 1]
                    if (name && genreSlug) {
                        genres.push({ name, slug: genreSlug, link: `/api/genres/${genreSlug}` })
                    }
                }
            })
        }

        // Parsing Strategy 2: Standard .infozin (common on /anime/ pages)
        if (!japanese) {
            $('.infozin p').each((i, el) => {
                const text = $(el).text()
                if (text.includes('Japanese'))
                    japanese = text.replace('Japanese', '').replace(':', '').trim()
                if (text.includes('Skor')) score = text.replace('Skor', '').replace(':', '').trim()
                if (text.includes('Produser'))
                    producers = text.replace('Produser', '').replace(':', '').trim()
                if (text.includes('Tipe')) type = text.replace('Tipe', '').replace(':', '').trim()
                if (text.includes('Status'))
                    status = text.replace('Status', '').replace(':', '').trim()
                if (text.includes('Total Episode'))
                    total_episode = text.replace('Total Episode', '').replace(':', '').trim()
                if (text.includes('Durasi'))
                    duration = text.replace('Durasi', '').replace(':', '').trim()
                if (text.includes('Tanggal Rilis'))
                    release_date = text.replace('Tanggal Rilis', '').replace(':', '').trim()

                if (text.includes('Genre')) {
                    $(el)
                        .find('a')
                        .each((j, a) => {
                            const name = $(a).text().trim()
                            const link = $(a).attr('href') || ''
                            const parts = link.split('/')
                            const genreSlug = parts[parts.length - 2] || parts[parts.length - 1]
                            if (name && genreSlug) {
                                genres.push({
                                    name,
                                    slug: genreSlug,
                                    link: `/api/genres/${genreSlug}`
                                })
                            }
                        })
                }
            })
        }

        // Parsing Strategy 3: Check for Batch Links in .batchlink (typical for Lengkap pages)
        const batch_links: ScrapedEpisode[] = []
        const lengkap_links: ScrapedEpisode[] = []

        if ($('.batchlink').length > 0) {
            $('.batchlink a').each((i, el) => {
                const bLink = $(el).attr('href')
                const bTitle = $(el).text().trim()
                // Only consider it a "Batch Link" if it points to a batch page (contains /batch/)
                if (bLink && bTitle) {
                    let bSlug = ''
                    const parts = bLink.split('/')
                    bSlug = parts[parts.length - 2] || parts[parts.length - 1]

                    if (bLink.includes('/lengkap/') || bTitle.toLowerCase().includes('lengkap')) {
                        lengkap_links.push({ title: bTitle, slug: bSlug, link: bLink })
                    } else {
                        batch_links.push({ title: bTitle, slug: bSlug, link: bLink })
                    }
                }
            })
        }

        // Episode List
        const episodes: ScrapedEpisode[] = []
        // Extended strategy: batch_links already declared above, just append if found in list
        // Standard list
        if ($('.episodelist').length > 0) {
            $('.episodelist ul li').each((i, el) => {
                const epTitle = $(el).find('span a').text().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
                const epLink = $(el).find('span a').attr('href')
                const epDate = $(el).find('.zeebr').text().trim()
                let epSlug = ''
                if (epLink) {
                    const parts = epLink.split('/')
                    epSlug = parts[parts.length - 2] || parts[parts.length - 1]
                }
                if (epTitle && epLink) {
                    const lowerTitle = epTitle.toLowerCase()
                    const isLengkap = lowerTitle.includes('lengkap') || epLink.includes('/lengkap/')
                    const isBatch = !isLengkap && (lowerTitle.includes('batch') || title.includes('[Batch]') || epLink.includes('/batch/'))

                    if (isLengkap) {
                        lengkap_links.push({ title: epTitle, slug: epSlug, link: epLink, date: epDate })
                    } else if (isBatch) {
                        batch_links.push({ title: epTitle, slug: epSlug, link: epLink, date: epDate })
                    } else {
                        episodes.push({ title: epTitle, slug: epSlug, link: epLink, date: epDate })
                    }
                }
            })
        }

        return {
            title,
            japanese,
            score,
            producers,
            type,
            status,
            total_episode,
            duration,
            synopsis,
            image,
            release_date,
            genres,
            episodes,
            batch_links,
            lengkap_links
        }
    } catch (error) {
        console.error('Scraping Anime Detail Error:', error)
        return null
    }
}

/**
 * Searches for anime based on a query string.
 *
 * @param {string} query - The search keyword.
 * @returns {Promise<ScrapedAnime[]>} A list of anime matching the search query.
 */
export async function scrapeSearch(query: string): Promise<ScrapedAnime[]> {
    try {
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=anime`
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)
        const results: ScrapedAnime[] = []

        $('.chivsrc li').each((i, el) => {
            const title = $(el).find('h2 a').text().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
            const link = $(el).find('h2 a').attr('href')
            const image = $(el).find('img').attr('src')

            const genres: string[] = []
            let status = 'N/A'
            let rating = 'N/A'

            // Parse .set (or text nodes)
            $(el).find('.set, .sets, .set2').each((j, set) => {
                const text = $(set).text().trim()
                if (text.startsWith('Genres')) {
                    const genreText = text.replace('Genres :', '').replace('Genres:', '').trim()
                    genreText.split(',').forEach(g => {
                        const trimmed = g.trim()
                        if (trimmed) genres.push(trimmed)
                    })
                } else if (text.startsWith('Status')) {
                    status = text.replace('Status :', '').replace('Status:', '').trim()
                } else if (text.startsWith('Rating')) {
                    rating = text.replace('Rating :', '').replace('Rating:', '').trim() || 'N/A'
                }
            })


            let slug = ''
            if (link) {
                const parts = link.split('/')
                slug = parts[parts.length - 2] || parts[parts.length - 1]
            }

            if (title && link) {
                results.push({
                    title,
                    slug,
                    link,
                    image,
                    genres: genres.length > 0 ? genres : undefined,
                    status,
                    rating
                    // episode and date are NOT included as per request
                })
            }
        })

        return results
    } catch (error) {
        console.error('Scraping Search Error:', error)
        return []
    }
}

/**
 * Scrapes the comprehensive list of all anime available on the site.
 *
 * @returns {Promise<ScrapedAnimeList[]>} A simple list including title, link, status, and type.
 */
export async function scrapeAnimeList(): Promise<ScrapedAnimeList[]> {
    try {
        const url = `${BASE_URL}/anime-list/`
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)
        const results: ScrapedAnimeList[] = []

        $('#abtext .jdlbar ul li a').each((i, el) => {
            let title = $(el).text().trim()
            const link = $(el).attr('href')
            let status = 'Completed' // Default
            let type = 'Series' // Default

            if (title.endsWith('On-Going')) {
                status = 'Ongoing'
                title = title.replace('On-Going', '').trim()
            } else if (title.endsWith('Movie')) {
                type = 'Movie'
                title = title.replace('Movie', '').trim()
            }

            let slug = ''
            if (link) {
                const parts = link.split('/')
                slug = parts[parts.length - 2] || parts[parts.length - 1]
            }

            if (title && link) {
                results.push({ title, slug, link, status, type })
            }
        })

        return results
    } catch (error) {
        console.error('Scraping Anime List Error:', error)
        return []
    }
}

export async function scrapeSchedule(): Promise<ScrapedSchedule[]> {
    try {
        const url = `${BASE_URL}/jadwal-rilis/`
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)
        const results: ScrapedSchedule[] = []

        $('.kglist321').each((i, el) => {
            const day = $(el).find('h2').text().trim()
            const animeList: { title: string; slug: string; link: string }[] = []

            $(el)
                .find('ul li a')
                .each((j, a) => {
                    const title = $(a).text().trim()
                    const link = $(a).attr('href')
                    let slug = ''
                    if (link) {
                        const parts = link.split('/')
                        slug = parts[parts.length - 2] || parts[parts.length - 1]
                    }
                    if (title && link) {
                        animeList.push({ title, slug, link })
                    }
                })

            if (day && animeList.length > 0) {
                results.push({ day, animeList })
            }
        })

        return results
    } catch (error) {
        console.error('Scraping Schedule Error:', error)
        return []
    }
}

export async function scrapeOngoing(page: number = 1): Promise<ScrapedAnime[]> {
    try {
        const url = `${BASE_URL}/ongoing-anime/page/${page}/`
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)
        const results: ScrapedAnime[] = []

        $('.venz .detpost').each((i, el) => {
            const title = $(el).find('.jdlflm').text().trim()
            const link = $(el).find('.thumb a').attr('href')
            const image = $(el).find('.thumb a img').attr('src')
            const episode = $(el).find('.epz').text().trim()
            const date = $(el).find('.newnime').text().trim()

            let slug = ''
            if (link) {
                const parts = link.split('/')
                slug = parts[parts.length - 2] || parts[parts.length - 1]
            }

            if (title && link) {
                results.push({ title, slug, link, image, episode, date })
            }
        })

        return results
    } catch (error) {
        console.error('Scraping Ongoing Error:', error)
        return []
    }
}

export async function scrapeGenreList(): Promise<ScrapedGenre[]> {
    try {
        const url = `${BASE_URL}/genre-list/`
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)
        const results: ScrapedGenre[] = []

        $('.genres li a').each((i, el) => {
            const name = $(el).text().trim()
            const link = $(el).attr('href')
            let slug = ''
            if (link) {
                const parts = link.split('/')
                slug = parts[parts.length - 2] || parts[parts.length - 1]
            }
            if (name && link) {
                const internalLink = `/api/genres/${slug}`
                results.push({ name, slug, link: internalLink })
            }
        })

        return results
    } catch (error) {
        console.error('Scraping Genre List Error:', error)
        return []
    }
}

export async function scrapeCompleteAnime(page: number = 1): Promise<ScrapedAnime[]> {
    try {
        const url = `${BASE_URL}/complete-anime/page/${page}/`
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)
        const results: ScrapedAnime[] = []

        $('.venz .detpost').each((i, el) => {
            const title = $(el).find('.jdlflm').text().trim()
            const link = $(el).find('.thumb a').attr('href')
            const image = $(el).find('.thumb a img').attr('src')
            const episode = $(el).find('.epz').text().trim()
            const date = $(el).find('.newnime').text().trim()

            let slug = ''
            if (link) {
                const parts = link.split('/')
                slug = parts[parts.length - 2] || parts[parts.length - 1]
            }

            if (title && link) {
                results.push({ title, slug, link, image, episode, date })
            }
        })

        return results
    } catch (error) {
        console.error('Scraping Complete Anime Error:', error)
        return []
    }
}

/**
 * Scrapes detail for a specific episode, including streaming mirrors and download links.
 *
 * @param {string} slug - The episode slug (e.g., 'one-piece-episode-1000-sub-indo').
 * @returns {Promise<ScrapedEpisodeDetail | null>} Stream/Download data, or null if not found.
 */
export async function scrapeEpisodeDetail(slug: string): Promise<ScrapedEpisodeDetail | null> {
    try {
        const url = `${BASE_URL}/episode/${slug}/`
        const { data } = await axios.get(url)
        const $ = cheerio.load(data)

        const title = $('.venz h1.posttl').text().trim()
        const streamUrl = $('.responsive-embed-stream iframe').attr('src') || ''

        // Extract streaming mirrors for all quality levels
        const streaming_mirrors: StreamMirror[] = []
        const qualitySelectors = [
            { selector: '.m360p', quality: '360p' },
            { selector: '.m480p', quality: '480p' },
            { selector: '.m720p', quality: '720p' },
            { selector: '.m1080p', quality: '1080p' }
        ]

        // 1. Fetch Nonce first (needed for all mirrors)
        const nonce = await getNonce()

        for (const { selector, quality } of qualitySelectors) {
            const rawSources: { name: string; payload: AjaxMirrorPayload }[] = []

            // 2. Extract payloads
            // Selector fix: The quality class (e.g., .m360p) is on the <ul> itself, not a wrapper div
            $(`.mirrorstream ${selector} li`).each((_i, el) => {
                const name = $(el).find('a').text().trim()
                const content = $(el).find('a').attr('data-content')
                if (content) {
                    let decoded = ''
                    try {
                        decoded = Buffer.from(content, 'base64').toString('utf-8')
                        // Try to parse as JSON first (new format)
                        const payload = JSON.parse(decoded) as AjaxMirrorPayload
                        rawSources.push({ name, payload })
                    } catch (_e) {
                        // Fallback for old style simple src="..." (unlikely but safe)
                        if (decoded && decoded.includes('src="')) {
                            const match = decoded.match(/src="([^"]+)"/)
                            if (match && match[1]) {
                                // Used to push directly, now we handle differently or ignore
                                // For now, let's ignore mixed types or assume JSON is the way
                            }
                        }
                    }
                }
            })

            // 3. Resolve URLs in parallel (Ajax)
            if (rawSources.length > 0 && nonce) {
                const resolvedSources = await Promise.all(
                    rawSources.map(async (src) => {
                        const url = await resolveAjaxMirror(src.payload, nonce)
                        return url ? { name: src.name, url } : null
                    })
                )

                const validSources = resolvedSources.filter((s): s is StreamSource => s !== null)

                if (validSources.length > 0) {
                    streaming_mirrors.push({ quality, sources: validSources })
                }
            }
        }

        const download_links: DownloadItem[] = []
        $('.download ul li').each((_i, el) => {
            const resolution = $(el).find('strong').text().trim()
            const links: DownloadLink[] = []
            $(el)
                .find('a')
                .each((_j, a) => {
                    const provider = $(a).text().trim()
                    const dUrl = $(a).attr('href')
                    if (provider && dUrl) {
                        links.push({ provider, url: dUrl })
                    }
                })
            if (resolution && links.length > 0) {
                download_links.push({ resolution, links })
            }
        })


        // Navigation links
        const prevLink = $('.prevnext .flir a[title="Episode Sebelumnya"]')
        const nextLink = $('.prevnext .flir a[title="Episode Selanjutnya"]')

        let prevEpisode: { title: string; slug: string; url: string } | null = null
        let nextEpisode: { title: string; slug: string; url: string } | null = null

        if (prevLink.length > 0) {
            const href = prevLink.attr('href') || ''
            const slug = href.split('/').filter(Boolean).pop() || ''
            prevEpisode = {
                title: prevLink.attr('title') || 'Episode Sebelumnya',
                slug,
                url: href
            }
        }

        if (nextLink.length > 0) {
            const href = nextLink.attr('href') || ''
            const slug = href.split('/').filter(Boolean).pop() || ''
            nextEpisode = {
                title: nextLink.attr('title') || 'Episode Selanjutnya',
                slug,
                url: href
            }
        }

        return {
            title,
            streamUrl,
            streaming_mirrors,
            download_links,
            hasPrevEpisode: prevEpisode !== null,
            prevEpisode,
            hasNextEpisode: nextEpisode !== null,
            nextEpisode
        }
    } catch (error) {
        console.error('Scraping Episode Detail Error:', error)
        return null
    }
}

export async function scrapeAnimeByGenre(
    genreSlug: string,
    page: number = 1
): Promise<ScrapedAnime[]> {
    try {
        const url = `${BASE_URL}/genres/${genreSlug}/page/${page}/`
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const $ = cheerio.load(data)
        const results: ScrapedAnime[] = []

        // Debug: Check if container exists
        // console.log(`[DEBUG] Found .venser .col-anime: ${$('.venser .col-anime').length}`);

        // Validated selector for Genre Page (uses .col-anime structure)
        $('.venser .col-anime').each((i, el) => {
            const title = $(el).find('.col-anime-title a').text().trim()
            const link = $(el).find('.col-anime-title a').attr('href')
            const image = $(el).find('.col-anime-cover img').attr('src')
            const episode = $(el).find('.col-anime-eps').text().trim()
            const date = $(el).find('.col-anime-date').text().trim()

            let slug = ''
            if (link) {
                const parts = link.split('/')
                slug = parts[parts.length - 2] || parts[parts.length - 1]
            }

            if (title && link) {
                results.push({ title, slug, link, image, episode, date })
            }
        })

        return results
    } catch (error) {
        console.error('Scraping Genre Error:', error)
        return []
    }
}

export async function scrapeBatch(slug: string): Promise<ScrapedBatch | null> {
    try {
        let url = `${BASE_URL}/batch/${slug}/`
        let response
        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try {
            response = await axios.get(url, { headers })
        } catch (_e) {
            // console.log(`[DEBUG] Initial Batch request failed: ${e.message}`);
        }

        let $ = cheerio.load(response ? response.data : '')

        // Soft 404 Check
        if (!response || $('.batchlink').length === 0) {
            const fallbackUrl = `${BASE_URL}/lengkap/${slug}/`
            try {
                response = await axios.get(fallbackUrl, { headers })
                $ = cheerio.load(response.data)
                url = fallbackUrl
                // console.log(`[DEBUG] Fallback to: ${url}`);
            } catch (_err) {
                // console.error(`[DEBUG] Fallback failed: ${err.message}`);
                return null
            }
        }

        const title =
            $('.batchlink h4').text().trim() ||
            $('.jdlrx h1').text().trim() ||
            $('.jdlflm').text().trim()

        // Extended Metadata Extraction
        const image = $('.fotoanime img').attr('src') || $('.separator img').attr('src') || ''
        const synopsis = $('.sinopc').text().trim()

        // Metadata from .infos (Complete/Lengkap pages)
        let japanese = ''
        let score = ''
        let producers = ''
        let type = ''
        let status = ''
        let total_episode = ''
        let duration = ''
        let aired = ''
        let studios = ''

        // Parse .infos content (format: <b>Key</b>: Value<br>)
        const infoHtml = $('.infos').html()
        if (infoHtml) {
            const lines = infoHtml.split('<br>')
            lines.forEach((line) => {
                // Remove HTML tags for cleaner parsing
                const cleanLine = line.replace(/<[^>]*>/g, '').trim()
                if (cleanLine.includes('Japanese:'))
                    japanese = cleanLine.replace('Japanese:', '').trim()
                else if (cleanLine.includes('Skor:')) score = cleanLine.replace('Skor:', '').trim()
                else if (cleanLine.includes('Produser:'))
                    producers = cleanLine.replace('Produser:', '').trim()
                else if (cleanLine.includes('Tipe:')) type = cleanLine.replace('Tipe:', '').trim()
                else if (cleanLine.includes('Status:'))
                    status = cleanLine.replace('Status:', '').trim()
                else if (cleanLine.includes('Total Episode:'))
                    total_episode = cleanLine.replace('Total Episode:', '').trim()
                else if (cleanLine.includes('Durasi:'))
                    duration = cleanLine.replace('Durasi:', '').trim()
                else if (cleanLine.includes('Tanggal Rilis:') || cleanLine.includes('Aired:'))
                    aired = cleanLine.replace('Tanggal Rilis:', '').replace('Aired:', '').trim()
                else if (cleanLine.includes('Studio:'))
                    studios = cleanLine.replace('Studio:', '').trim()
            })
        }

        // Fallback to standard detail selectors if .infos didn't cover it (e.g. standard batch page)
        if (!japanese) {
            $('.infozingle p, .infozin p').each((i, el) => {
                const text = $(el).text()
                if (text.includes('Japanese'))
                    japanese = text.replace('Japanese', '').replace(':', '').trim()
                else if (text.includes('Skor'))
                    score = text.replace('Skor', '').replace(':', '').trim()
                else if (text.includes('Produser'))
                    producers = text.replace('Produser', '').replace(':', '').trim()
                else if (text.includes('Tipe'))
                    type = text.replace('Tipe', '').replace(':', '').trim()
                else if (text.includes('Status'))
                    status = text.replace('Status', '').replace(':', '').trim()
                else if (text.includes('Total Episode'))
                    total_episode = text.replace('Total Episode', '').replace(':', '').trim()
                else if (text.includes('Durasi'))
                    duration = text.replace('Durasi', '').replace(':', '').trim()
                else if (text.includes('Tanggal Rilis') || text.includes('Aired'))
                    aired = text
                        .replace('Tanggal Rilis', '')
                        .replace('Aired', '')
                        .replace(':', '')
                        .trim()
                else if (text.includes('Studio'))
                    studios = text.replace('Studio', '').replace(':', '').trim()
            })
        }

        const genres: { title: string; slug: string; link: string }[] = []
        // Extract genres from .infos or .infozingle
        const genreContainer =
            $('.infos').length > 0
                ? $('.infos')
                : $('.infozingle p span b:contains("Genre")').parent()

        genreContainer.find('a').each((i, el) => {
            const href = $(el).attr('href')
            if (href && href.includes('/genres/')) {
                const genreTitle = $(el).text().trim()
                const genreUrl = href
                let genreSlug = ''
                if (genreUrl) {
                    const parts = genreUrl.split('/')
                    genreSlug = parts[parts.length - 2] || parts[parts.length - 1]
                }
                if (genreTitle && genreSlug) {
                    genres.push({
                        title: genreTitle,
                        slug: genreSlug,
                        link: `/api/genres/${genreSlug}`
                    })
                }
            }
        })

        const downloadUrls: DownloadItem[] = []

        if ($('.batchlink').length > 0) {
            $('.batchlink ul li').each((i, el) => {
                const resolution = $(el).find('strong').text().trim()
                const links: DownloadLink[] = []
                $(el)
                    .find('a')
                    .each((j, a) => {
                        const provider = $(a).text().trim()
                        const url = $(a).attr('href') || ''
                        if (provider && url) links.push({ provider, url })
                    })
                if (resolution && links.length > 0) downloadUrls.push({ resolution, links })
            })
        } else if ($('.download').length > 0) {
            $('.download h4').each((i, h4) => {
                const epTitle = $(h4).text().trim()
                const ul = $(h4).next('ul')
                ul.find('li').each((j, li) => {
                    const resolution = $(li).find('strong').text().trim()
                    const links: DownloadLink[] = []
                    $(li)
                        .find('a')
                        .each((k, a) => {
                            const provider = $(a).text().trim()
                            const url = $(a).attr('href') || ''
                            if (provider && url) links.push({ provider, url })
                        })
                    if (resolution && links.length > 0) {
                        const fullTitle = `${epTitle} - ${resolution}`
                        downloadUrls.push({ resolution: fullTitle, links })
                    }
                })
            })
        }

        return {
            title,
            downloadUrls,
            image,
            synopsis,
            japanese,
            score,
            producers,
            type,
            status,
            total_episode,
            duration,
            aired,
            studios,
            genres
        }
    } catch (error) {
        console.error('Scraping Batch Error:', error)
        return null
    }
}

// --- Helper Functions for AJAX Mirror Resolution ---

async function getNonce(): Promise<string | null> {
    try {
        const { data } = await axios.post(
            `${BASE_URL}/wp-admin/admin-ajax.php`,
            new URLSearchParams({ action: 'aa1208d27f29ca340c92c66d1926f13f' }),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        )
        return data.data || null
    } catch (_e) {
        return null
    }
}

async function resolveAjaxMirror(
    payload: AjaxMirrorPayload,
    nonce: string
): Promise<string | null> {
    try {
        const postData = {
            id: payload.id.toString(),
            i: payload.i.toString(),
            q: payload.q,
            nonce,
            action: '2a3505c93b0035d3f455df82bf976b84'
        }

        const { data } = await axios.post(
            `${BASE_URL}/wp-admin/admin-ajax.php`,
            new URLSearchParams(postData),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        )

        const encodedHtml = data.data
        if (!encodedHtml) return null

        const decodedHtml = Buffer.from(encodedHtml, 'base64').toString('utf-8')
        const match = decodedHtml.match(/src="([^"]+)"/)
        return match ? match[1] : null
    } catch (_e) {
        return null
    }
}

/**
 * Scrapes the 'Lengkap' (Complete) page for an anime, which provides aggregated download links.
 *
 * @param {string} slug - The slug of the anime.
 * @returns {Promise<ScrapedLengkap | null>} The scraped data or null if not found.
 */
export async function scrapeLengkap(slug: string): Promise<ScrapedLengkap | null> {
    try {
        const url = `${BASE_URL}/lengkap/${slug}/`
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const $ = cheerio.load(data)

        if ($('.fotoanime').length === 0 && $('.imganime').length === 0) return null

        const title = $('.jdlrx h1').text().trim()
        const image = $('.fotoanime img').attr('src') || $('.imganime img').attr('src') || ''

        let japanese = ''
        let score = ''
        let producers = ''
        let type = ''
        let total_episode = ''
        let duration = ''
        let release_date = ''

        // Parsing metadata from .infos using <br> split strategy
        const infoHtml = $('.infos').html()
        if (infoHtml) {
            const lines = infoHtml.split('<br>')
            lines.forEach((line) => {
                const cleanLine = line.replace(/<[^>]*>/g, '').trim()
                if (cleanLine.includes('Japanese:'))
                    japanese = cleanLine.split(':')[1]?.trim()
                else if (cleanLine.includes('Score:') || cleanLine.includes('Rating:') || cleanLine.includes('Skor:'))
                    score = cleanLine.split(':')[1]?.trim()
                else if (cleanLine.includes('Producers:') || cleanLine.includes('Produser:'))
                    producers = cleanLine.split(':')[1]?.trim()
                else if (cleanLine.includes('Type:') || cleanLine.includes('Tipe:'))
                    type = cleanLine.split(':')[1]?.trim()
                else if (cleanLine.includes('Total Episode:') || cleanLine.includes('Episodes:'))
                    total_episode = cleanLine.split(':')[1]?.trim()
                else if (cleanLine.includes('Duration:') || cleanLine.includes('Durasi:'))
                    duration = cleanLine.split(':')[1]?.trim()
                else if (cleanLine.includes('Tanggal Rilis:') || cleanLine.includes('Aired:') || cleanLine.includes('Date:'))
                    release_date = cleanLine.split(':')[1]?.trim()
            })
        }

        const episodes: { title: string; downloadUrls: { resolution: string; links: { provider: string; url: string }[] }[] }[] = []
        let batch: { title: string; downloadUrls: { resolution: string; links: { provider: string; url: string }[] }[] } | undefined

        // Iterate over all h4 headers inside .download containers
        $('.download h4').each((_, h4) => {
            const header = $(h4).text().trim()
            const links: { resolution: string; links: { provider: string; url: string }[] }[] = []

            // The links are in the next sibling 'ul'
            const ul = $(h4).next('ul')

            ul.find('li').each((_, li) => {
                const resolution = $(li).find('strong').text().trim()
                const linkList: { provider: string; url: string }[] = []
                $(li).find('a').each((_, a) => {
                    linkList.push({
                        provider: $(a).text().trim(),
                        url: $(a).attr('href') || ''
                    })
                })
                links.push({ resolution, links: linkList })
            })

            if (header.toLowerCase().includes('batch')) {
                batch = {
                    title: header,
                    downloadUrls: links
                }
            } else {
                episodes.push({
                    title: header,
                    downloadUrls: links
                })
            }
        })

        return {
            title,
            japanese,
            score,
            producers,
            type,
            total_episode,
            duration,
            image,
            release_date,
            episodes,
            batch
        }

    } catch (e) {
        console.error(`Error scraping lengkap ${slug}:`, e)
        return null
    }
}
