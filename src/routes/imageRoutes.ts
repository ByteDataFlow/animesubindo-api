import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { ImageController } from '../controllers/ImageController'

export const registerImageRoutes = (app: OpenAPIHono) => {
    // --- Route: Proxy Image ---
    app.openapi(
        createRoute({
            method: 'get',
            path: '/api/image',
            tags: ['Utilities'], // Group under Utilities
            summary: 'Proxy Image',
            description:
                'Proxies image requests to bypass CORS/Hotlink protection. Requires a valid URL.',
            request: {
                query: z.object({
                    url: z
                        .string()
                        .url()
                        .openapi({ example: 'https://otakudesu.blog/wp-content/uploads/...' })
                })
            },
            responses: {
                200: {
                    description: 'Image binary stream',
                    content: {
                        'image/*': {
                            schema: {
                                type: 'string',
                                format: 'binary'
                            }
                        }
                    }
                },
                400: {
                    description: 'Invalid URL',
                    content: {
                        'application/json': {
                            schema: z.object({
                                status: z.string(),
                                message: z.string()
                            })
                        }
                    }
                },
                502: {
                    description: 'Upstream Error',
                    content: {
                        'application/json': {
                            schema: z.object({
                                status: z.string(),
                                message: z.string()
                            })
                        }
                    }
                }
            }
        }),
        ImageController.proxyImage
    )
}
