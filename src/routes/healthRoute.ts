/* eslint-disable @typescript-eslint/no-explicit-any */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const healthRoute = createRoute({
    method: 'get',
    path: '/health',
    summary: 'Health Check',
    description: 'Returns server status for monitoring and load balancers',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('healthy'),
                        timestamp: z.string(),
                        uptime: z.number()
                    })
                }
            },
            description: 'Server is healthy'
        }
    }
})

export const registerHealthRoute = (app: OpenAPIHono) => {
    app.openapi(healthRoute, ((c: any) => {
        return c.json(
            {
                status: 'healthy' as const,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            },
            200
        )
    }) as any)
}
