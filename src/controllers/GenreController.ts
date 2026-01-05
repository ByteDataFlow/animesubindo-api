/* eslint-disable @typescript-eslint/no-explicit-any */
import { scrapeGenreList, scrapeAnimeByGenre } from '../scrapers/otakudesu'
import { getCachedData } from '../lib/utils'

export class GenreController {
    static getGenreList = async (c: any) => {
        const data = await getCachedData('v1_genrelist', scrapeGenreList, 86400)
        return c.json({ status: 'success', data }, 200)
    }

    static getAnimeByGenre = async (c: any) => {
        const { slug } = c.req.valid('param')
        const { page } = c.req.valid('query')
        const key = `v1_genre_${slug}_${page}`
        const data = await getCachedData(key, () => scrapeAnimeByGenre(slug, page as number), 1800)

        return c.json({ status: 'success', data }, 200)
    }
}
