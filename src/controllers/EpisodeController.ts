/* eslint-disable @typescript-eslint/no-explicit-any */
import { scrapeEpisodeDetail } from '../scrapers/otakudesu'
import { getCachedData, AppError } from '../lib/utils'

export class EpisodeController {
    static getEpisodeDetail = async (c: any) => {
        const slug = c.req.valid('param').slug
        const key = `v1_episode_${slug}`
        const data = await getCachedData(key, () => scrapeEpisodeDetail(slug), 1800)

        if (!data) throw new AppError('Episode not found', 404, 'NOT_FOUND')
        return c.json({ status: 'success', data }, 200)
    }
}
