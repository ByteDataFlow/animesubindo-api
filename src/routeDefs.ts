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
    BatchSchema,
    LengkapSchema,
    ProxyQuerySchema,
    ResolvedStreamSchema
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
        params: z.object({
            slug: z.string().openapi({ example: 'sozai-isekai-ryokouki-sub-indo' })
        })
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
        params: z.object({ slug: z.string().openapi({ example: 'action' }) }),
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
                                    link: 'https://otakudesu.blog/anime/one-piece-sub-indo/',
                                    image: 'https://otakudesu.blog/.../op.jpg',
                                    episode: 'Episode 1000',
                                    date: 'Hari Ini'
                                },
                                {
                                    title: 'Boruto: Naruto Next Generations',
                                    slug: 'boruto-naruto-next-generations-sub-indo',
                                    link: 'https://otakudesu.blog/anime/boruto-naruto-next-generations-sub-indo/',
                                    image: 'https://otakudesu.blog/.../boruto.jpg',
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
        params: z.object({ slug: z.string().openapi({ example: 'ssnir-episode-1-sub-indo' }) })
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
        params: z.object({ slug: z.string().openapi({ example: 'ssnir-batch-sub-indo' }) })
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

export const getLengkapRoute = createRoute({
    method: 'get',
    path: '/api/lengkap/{slug}',
    summary: 'Get Anime Lengkap (Aggregated)',
    request: {
        params: z.object({ slug: z.string().openapi({ example: 'ssnir-sub-indo' }) })
    },
    responses: {
        200: {
            content: { 'application/json': { schema: SuccessResponseSchema(LengkapSchema) } },
            description: 'Lengkap details'
        },
        404: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Not Found'
        }
    }
})

// --- Proxy Routes ---

export const getProxyStreamRoute = createRoute({
    method: 'get',
    path: '/api/proxy-stream',
    summary: 'Proxy Iframe Stream',
    request: {
        query: ProxyQuerySchema
    },
    responses: {
        200: {
            content: {
                'text/html': { schema: z.string() }
            },
            description: 'Proxied HTML iframe content'
        },
        500: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})

// --- Stream Resolver Routes ---

export const getResolveStreamRoute = createRoute({
    method: 'get',
    path: '/api/resolve-stream',
    summary: 'Resolve Direct Video URL',
    description:
        'Extracts the direct video URL (mp4/hls) from a supported mirror embed URL (filedon, vidhide). Returns null for unsupported mirrors.',
    request: {
        query: ProxyQuerySchema
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: SuccessResponseSchema(ResolvedStreamSchema)
                }
            },
            description: 'Resolved video URL, or null if unsupported'
        },
        500: {
            content: { 'application/json': { schema: ErrorResponseSchema } },
            description: 'Internal Server Error'
        }
    }
})
