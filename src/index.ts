import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { globalErrorHandler } from './lib/utils'

// Middleware
import { corsMiddleware } from './middleware/cors'
import { requestLogger } from './middleware/logger'
import { apiRateLimiter } from './middleware/rateLimiter'

// Route Registrars
import { registerAnimeRoutes } from './routes/animeRoutes'
import { registerGenreRoutes } from './routes/genreRoutes'
import { registerEpisodeRoutes } from './routes/episodeRoutes'
import { registerBatchRoutes } from './routes/batchRoutes'
import { registerHealthRoute } from './routes/healthRoute'

// --- App Setup ---
const app = new OpenAPIHono()

// --- Middleware Stack ---
app.use('/*', requestLogger)
app.use('/*', corsMiddleware)
app.use('/api/*', apiRateLimiter)
app.onError(globalErrorHandler)

app.notFound((c) => {
    return c.json({
        status: 'error',
        message: 'Endpoint Not Found',
        code: 'NOT_FOUND'
    }, 404)
})

// --- Register Routes ---
registerHealthRoute(app)
registerAnimeRoutes(app)
registerGenreRoutes(app)
registerEpisodeRoutes(app)
registerBatchRoutes(app)

// --- Swagger Docs ---
app.doc('/doc', {
    openapi: '3.0.0',
    info: {
        version: '1.0.0',
        title: 'Anime API Enterprise',
        description: 'Enterprise-grade anime data aggregation service providing real-time metadata, streaming availability, and schedule synchronization.\n\n**System Capabilities:**\n- ⚡ **Low-Latency Edge Caching**\n- 🛡️ **Zod-Powered Request Validation**\n- 🔄 **Auto-Healing Fallback Strategy**\n\n\n---\n*Powered by Otakudesu.best Source Adapter*'
    }
})

app.get('/ui', swaggerUI({ url: '/doc' }))

// Welcome Endpoint
app.get('/', (c) => {
    return c.html(`
        <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h1>Anime API Running</h1>
            <p>Go to <a href="/ui">/ui</a> for Documentation.</p>
        </div>
    `)
})

const port = 3000

if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    console.log(`Server is running on http://localhost:${port} (OpenAPI Mode)`)
    serve({
        fetch: app.fetch,
        port
    })
}

export default app
