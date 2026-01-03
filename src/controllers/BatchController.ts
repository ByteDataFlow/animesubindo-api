
import { scrapeBatch } from '../scrapers/otakudesu'
import { getCachedData, AppError } from '../lib/utils'
import { getBatchDetailRoute } from '../routeDefs'

export class BatchController {

    static getBatch = async (c: any) => {
        const slug = c.req.valid('param').slug
        const key = `v1_batch_${slug}`
        const data = await getCachedData(key, () => scrapeBatch(slug), 86400)

        if (!data) throw new AppError('Batch not found', 404, 'NOT_FOUND')
        return c.json({ status: 'success', data }, 200)
    }
}
