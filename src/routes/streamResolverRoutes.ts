import { OpenAPIHono } from '@hono/zod-openapi'
import { getResolveStreamRoute } from '../routeDefs'
import { StreamResolverController } from '../controllers/StreamResolverController'

export const registerStreamResolverRoutes = (app: OpenAPIHono) => {
    app.openapi(getResolveStreamRoute, StreamResolverController.getResolveStream)
}
