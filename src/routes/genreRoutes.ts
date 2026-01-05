import { OpenAPIHono } from '@hono/zod-openapi'
import { GenreController } from '../controllers/GenreController'
import { getGenreListRoute, getAnimeByGenreRoute } from '../routeDefs'

export const registerGenreRoutes = (app: OpenAPIHono) => {
    app.openapi(getGenreListRoute, GenreController.getGenreList)
    app.openapi(getAnimeByGenreRoute, GenreController.getAnimeByGenre)
}
