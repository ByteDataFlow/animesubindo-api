import { OpenAPIHono } from '@hono/zod-openapi'
import { EpisodeController } from '../controllers/EpisodeController'
import { getEpisodeDetailRoute } from '../routeDefs'

export const registerEpisodeRoutes = (app: OpenAPIHono) => {
    app.openapi(getEpisodeDetailRoute, EpisodeController.getEpisodeDetail)
}
