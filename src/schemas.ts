import { z } from '@hono/zod-openapi'

// Re-usable basic schemas
export const DownloadLinkSchema = z.object({
    provider: z.string().openapi({ example: 'ZippyShare' }),
    url: z.string().openapi({ example: 'https://zippyshare.com/...' })
})

export const DownloadItemSchema = z.object({
    resolution: z.string().openapi({ example: '720p' }),
    links: z.array(DownloadLinkSchema)
})

export const AnimeSchema = z
    .object({
        title: z.string().openapi({ example: 'One Piece' }),
        slug: z.string().openapi({ example: 'one-piece-sub-indo' }),
        link: z.string().openapi({ example: 'https://otakudesu.best/anime/one-piece-sub-indo/' }),
        image: z.string().optional().openapi({ example: 'https://otakudesu.best/.../op.jpg' }),
        episode: z.string().optional().openapi({ example: 'Episode 1000' }),
        date: z.string().optional().openapi({ example: 'Hari Ini' }),
        genres: z.array(z.string()).optional().openapi({ example: ['Action', 'Adventure'] }),
        status: z.string().optional().openapi({ example: 'Ongoing' }),
        rating: z.string().optional().openapi({ example: '8.5' })
    })
    .openapi('Anime')

export const HomeResponseSchema = z
    .object({
        ongoing: z.array(AnimeSchema),
        complete: z.array(AnimeSchema)
    })
    .openapi('HomeResponse')

export const EpisodeSchema = z.object({
    title: z.string(),
    slug: z.string(),
    link: z.string(),
    date: z.string().optional()
})

export const GenreSchema = z.object({
    name: z.string(),
    slug: z.string(),
    link: z.string()
})

export const AnimeDetailSchema = z
    .object({
        title: z.string(),
        japanese: z.string(),
        score: z.string(),
        producers: z.string(),
        type: z.string(),
        status: z.string(),
        total_episode: z.string(),
        duration: z.string(),
        synopsis: z.string(),
        image: z.string(),
        release_date: z.string().optional(),
        episodes: z.array(EpisodeSchema),
        genres: z.array(GenreSchema).optional()
    })
    .openapi('AnimeDetail')

export const AnimeListSchema = z.object({
    title: z.string(),
    slug: z.string(),
    link: z.string(),
    status: z.string().optional().openapi({ example: 'Ongoing' }),
    type: z.string().optional().openapi({ example: 'Series' })
})

export const ScheduleSchema = z.object({
    day: z.string().openapi({ example: 'Senin' }),
    animeList: z.array(AnimeListSchema)
})

export const EpisodeDetailSchema = z
    .object({
        title: z.string(),
        streamUrl: z.string(),
        mirror_stream_url: z.string(),
        download_links: z.array(DownloadItemSchema)
    })
    .openapi('EpisodeDetail')

export const BatchSchema = z
    .object({
        title: z.string(),
        downloadUrls: z.array(DownloadItemSchema),
        image: z.string().optional(),
        synopsis: z.string().optional(),
        japanese: z.string().optional(),
        score: z.string().optional(),
        producers: z.string().optional(),
        type: z.string().optional(),
        status: z.string().optional(),
        total_episode: z.string().optional(),
        duration: z.string().optional(),
        aired: z.string().optional(),
        studios: z.string().optional(),
        genres: z
            .array(
                z.object({
                    title: z.string(),
                    slug: z.string(),
                    link: z.string()
                })
            )
            .optional()
    })
    .openapi('Batch')

// Response Wrappers
export const SuccessResponseSchema = (schema: z.ZodTypeAny) =>
    z.object({
        status: z.string().openapi({ example: 'success' }),
        data: schema
    })

export const ErrorResponseSchema = z
    .object({
        status: z.string().openapi({ example: 'error' }),
        message: z.string().openapi({ example: 'Resource not found' }),
        code: z.string().openapi({ example: 'NOT_FOUND' })
    })
    .openapi('AppError')
