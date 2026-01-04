import { OpenAPIHono } from '@hono/zod-openapi'
import { GenreController } from '../controllers/GenreController'
import { getGenreListRoute, getAnimeByGenreRoute } from '../routeDefs'

export const registerGenreRoutes = (app: OpenAPIHono) => {
    app.openapi(getGenreListRoute, GenreController.getGenreList as any)
    app.openapi(getAnimeByGenreRoute, GenreController.getAnimeByGenre as any)
}
