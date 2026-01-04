import { OpenAPIHono } from '@hono/zod-openapi'
import { AnimeController } from '../controllers/AnimeController'
import {
    getHomeRoute,
    searchRoute,
    getAnimeDetailRoute,
    getAnimeListRoute,
    getScheduleRoute,
    getOngoingRoute,
    getCompletedRoute
} from '../routeDefs'

export const registerAnimeRoutes = (app: OpenAPIHono) => {
    app.openapi(getHomeRoute, AnimeController.getHome as any)
    app.openapi(searchRoute, AnimeController.search as any)
    app.openapi(getAnimeDetailRoute, AnimeController.getDetail as any)
    app.openapi(getAnimeListRoute, AnimeController.getList as any)
    app.openapi(getScheduleRoute, AnimeController.getSchedule as any)
    app.openapi(getOngoingRoute, AnimeController.getOngoing as any)
    app.openapi(getCompletedRoute, AnimeController.getCompleted as any)
}
