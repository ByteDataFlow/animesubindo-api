import { OpenAPIHono } from '@hono/zod-openapi'
import { AnimeController } from '../controllers/AnimeController'
import {
    getHomeRoute,
    searchRoute,
    getAnimeDetailRoute,
    getAnimeListRoute,
    getScheduleRoute,
    getOngoingRoute,
    getCompletedRoute,
    getLengkapRoute
} from '../routeDefs'

export const registerAnimeRoutes = (app: OpenAPIHono) => {
    app.openapi(getHomeRoute, AnimeController.getHome)
    app.openapi(searchRoute, AnimeController.search)
    app.openapi(getAnimeDetailRoute, AnimeController.getDetail)
    app.openapi(getAnimeListRoute, AnimeController.getList)
    app.openapi(getScheduleRoute, AnimeController.getSchedule)
    app.openapi(getOngoingRoute, AnimeController.getOngoing)
    app.openapi(getCompletedRoute, AnimeController.getCompleted)
    app.openapi(getLengkapRoute, AnimeController.getLengkap)
}
