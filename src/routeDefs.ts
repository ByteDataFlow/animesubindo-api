import { createRoute, z } from '@hono/zod-openapi'
import {
    HomeResponseSchema,
    SuccessResponseSchema,
    ErrorResponseSchema,
    AnimeSchema,
    AnimeDetailSchema,
    AnimeListSchema,
    ScheduleSchema,
    GenreSchema,
    EpisodeDetailSchema,
    BatchSchema
} from './schemas'

// --- Anime Routes ---

export const getHomeRoute = createRoute({
    method: 'get',
    path: '/api/home',
    summary: 'Get Latest Anime',
    description:
        'Returns a list of the latest uploaded anime, separated by Ongoing and Complete status.',
    responses: {
        200: {
            content: {
                'application/json': { schema: SuccessResponseSchema(HomeResponseSchema) }
            },
            description: 'Successful response'
        },
        500: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Server Error'
        }
    }
})

export const searchRoute = createRoute({
    method: 'get',
    path: '/api/search',
    summary: 'Search Anime',
    request: {
        query: z.object({
            q: z.string().min(3).openapi({ example: 'naruto' })
        })
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: SuccessResponseSchema(z.array(AnimeSchema)) }
            },
            description: 'Search results'
        },
        400: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Validation Error'
        }
    }
})

export const getAnimeDetailRoute = createRoute({
    method: 'get',
    path: '/api/anime/{slug}',
    summary: 'Get Anime Details',
    request: {
        params: z.object({ slug: z.string() })
    },
    responses: {
        200: {
            content: { 'application/json': { schema: SuccessResponseSchema(AnimeDetailSchema) } },
            description: 'Anime details'
        },
        404: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Not Found'
        }
    }
})

export const getAnimeListRoute = createRoute({
    method: 'get',
    path: '/api/anime-list',
    summary: 'Get All Anime',
    responses: {
        200: {
            content: {
                'application/json': { schema: SuccessResponseSchema(z.array(AnimeListSchema)) }
            },
            description: 'List of all anime'
        }
    }
})

export const getScheduleRoute = createRoute({
    method: 'get',
    path: '/api/schedule',
    summary: 'Get Release Schedule',
    responses: {
        200: {
            content: {
                'application/json': { schema: SuccessResponseSchema(z.array(ScheduleSchema)) }
            },
            description: 'Weekly schedule'
        }
    }
})

export const getOngoingRoute = createRoute({
    method: 'get',
    path: '/api/ongoing',
    summary: 'Get Ongoing Anime',
    request: {
        query: z.object({
            page: z
                .string()
                .optional()
                .default('1')
                .transform((val) => Number(val))
                .refine((val) => val >= 1, { message: 'Page must be >= 1' })
        })
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: SuccessResponseSchema(z.array(AnimeSchema)) }
            },
            description: 'List of ongoing anime'
        }
    }
})

export const getCompletedRoute = createRoute({
    method: 'get',
    path: '/api/complete',
    summary: 'Get Completed Anime',
    request: {
        query: z.object({
            page: z
                .string()
                .optional()
                .default('1')
                .transform((val) => Number(val))
                .refine((val) => val >= 1)
        })
    },
    responses: {
        200: {
            content: {
                'application/json': { schema: SuccessResponseSchema(z.array(AnimeSchema)) }
            },
            description: 'List of completed anime'
        }
    }
})

// --- Genre Routes ---

export const getGenreListRoute = createRoute({
    method: 'get',
    path: '/api/genres',
    summary: 'Get Genre List',
    responses: {
        200: {
            content: {
                'application/json': { schema: SuccessResponseSchema(z.array(GenreSchema)) }
            },
            description: 'List of genres'
        }
    }
})

export const getAnimeByGenreRoute = createRoute({
    method: 'get',
    path: '/api/genres/{slug}',
    summary: 'Get Anime by Genre',
    request: {
        params: z.object({ slug: z.string() }),
        query: z.object({
            page: z
                .string()
                .optional()
                .default('1')
                .transform((v) => Number(v))
        })
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: SuccessResponseSchema(
                        z.array(AnimeSchema).openapi({
                            example: [
                                {
                                    title: 'One Piece',
                                    slug: 'one-piece-sub-indo',
                                    link: 'https://otakudesu.best/anime/one-piece-sub-indo/',
                                    image: 'https://otakudesu.best/.../op.jpg',
                                    episode: 'Episode 1000',
                                    date: 'Hari Ini'
                                },
                                {
                                    title: 'Boruto: Naruto Next Generations',
                                    slug: 'boruto-naruto-next-generations-sub-indo',
                                    link: 'https://otakudesu.best/anime/boruto-naruto-next-generations-sub-indo/',
                                    image: 'https://otakudesu.best/.../boruto.jpg',
                                    episode: 'Episode 200',
                                    date: 'Kemarin'
                                }
                            ]
                        })
                    )
                }
            },
            description: 'Anime list by genre'
        }
    }
})

// --- Episode Routes ---

export const getEpisodeDetailRoute = createRoute({
    method: 'get',
    path: '/api/episode/{slug}',
    summary: 'Get Episode Details',
    request: {
        params: z.object({ slug: z.string() })
    },
    responses: {
        200: {
            content: { 'application/json': { schema: SuccessResponseSchema(EpisodeDetailSchema) } },
            description: 'Stream and download links'
        },
        404: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Not found'
        }
    }
})

// --- Batch Routes ---

export const getBatchDetailRoute = createRoute({
    method: 'get',
    path: '/api/batch/{slug}',
    summary: 'Get Batch Downloads',
    request: {
        params: z.object({ slug: z.string() })
    },
    responses: {
        200: {
            content: { 'application/json': { schema: SuccessResponseSchema(BatchSchema) } },
            description: 'Batch download info'
        },
        404: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Not found'
        }
    }
})
