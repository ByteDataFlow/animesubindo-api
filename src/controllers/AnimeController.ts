/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    scrapeHome,
    scrapeSearch,
    scrapeAnimeDetail,
    scrapeAnimeList,
    scrapeSchedule,
    scrapeOngoing,
    scrapeCompleteAnime
} from '../scrapers/otakudesu'
import { getCachedData, AppError } from '../lib/utils'

/**
 * Controller for Anime Related Enpoints
 */
export class AnimeController {
    static getHome = async (c: any) => {
        const data = await getCachedData('v1_home', scrapeHome, 300)
        return c.json({ status: 'success', data }, 200)
    }

    static search = async (c: any) => {
        const query = c.req.valid('query').q
        const key = `v1_search_${query.toLowerCase()}`
        const data = await getCachedData(key, () => scrapeSearch(query), 3600)
        return c.json({ status: 'success', data }, 200)
    }

    static getDetail = async (c: any) => {
        const slug = c.req.valid('param').slug
        const key = `v1_detail_${slug}`
        const data = await getCachedData(key, () => scrapeAnimeDetail(slug), 1800)
        if (!data) throw new AppError('Anime specified not found', 404, 'NOT_FOUND')
        return c.json({ status: 'success', data }, 200)
    }

    static getList = async (c: any) => {
        const data = await getCachedData('v1_animelist', scrapeAnimeList, 86400)
        return c.json({ status: 'success', data }, 200)
    }

    static getSchedule = async (c: any) => {
        const data = await getCachedData('v1_schedule', scrapeSchedule, 86400)
        return c.json({ status: 'success', data }, 200)
    }

    static getOngoing = async (c: any) => {
        const page = c.req.valid('query').page
        const key = `v1_ongoing_${page}`
        const data = await getCachedData(key, () => scrapeOngoing(page), 300)
        return c.json({ status: 'success', data }, 200)
    }

    static getCompleted = async (c: any) => {
        const page = c.req.valid('query').page
        const key = `v1_complete_${page}`
        const data = await getCachedData(key, () => scrapeCompleteAnime(page), 3600)
        return c.json({ status: 'success', data }, 200)
    }
}
