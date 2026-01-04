import { OpenAPIHono } from '@hono/zod-openapi'
import { BatchController } from '../controllers/BatchController'
import { getBatchDetailRoute } from '../routeDefs'

export const registerBatchRoutes = (app: OpenAPIHono) => {
    app.openapi(getBatchDetailRoute, BatchController.getBatch as any)
}
