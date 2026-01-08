import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
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
import { registerImageRoutes } from './routes/imageRoutes'
const app = new OpenAPIHono()

// --- Middleware Stack ---
app.use('/*', requestLogger)
app.use('/*', corsMiddleware)
app.use('/api/*', apiRateLimiter)
app.onError(globalErrorHandler)

app.notFound((c) => {
    return c.json(
        {
            status: 'error',
            message: 'Endpoint Not Found',
            code: 'NOT_FOUND'
        },
        404
    )
})

// --- Register Routes ---
// Serve static files (CSS, logo, etc.)
app.use('/swagger-custom.css', serveStatic({ path: './public/swagger-custom.css' }))
app.use('/assets/*', serveStatic({ root: './public/' }))

registerHealthRoute(app)
registerAnimeRoutes(app)
registerGenreRoutes(app)
registerEpisodeRoutes(app)
registerBatchRoutes(app)
registerImageRoutes(app)

// --- Swagger Docs ---
app.doc('/doc', {
    openapi: '3.0.0',
    info: {
        version: '1.0.0',
        title: 'Anime API Enterprise',
        description:
            'Enterprise-grade anime data aggregation service providing real-time metadata, streaming availability, and schedule synchronization.\n\n**System Capabilities:**\n- ⚡ **Low-Latency Edge Caching**\n- 🛡️ **Zod-Powered Request Validation**\n- 🔄 **Auto-Healing Fallback Strategy**\n\n\n---\n*Powered by Otakudesu.best Source Adapter*'
    }
})

// Custom branded Swagger UI
app.get('/ui', async (c) => {
    try {
        const fs = await import('fs/promises')
        const html = await fs.readFile('./public/swagger-ui.html', 'utf-8')
        return c.html(html)
    } catch (_error) {
        // Fallback to default Swagger UI if custom file not found
        return c.redirect('/ui/default')
    }
})

// Legacy Swagger UI (fallback)
app.get('/ui/default', swaggerUI({ url: '/doc' }))

// Welcome Endpoint
app.get('/', (c) => {
    return c.html(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Anime Subindo API</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #0A1628 0%, #1A2841 100%);
                    color: #E0E0E0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    text-align: center;
                    max-width: 600px;
                    padding: 40px;
                }
                img {
                    width: 150px;
                    height: 150px;
                    border-radius: 20px;
                    margin-bottom: 30px;
                    box-shadow: 0 10px 40px rgba(0, 217, 255, 0.3);
                }
                h1 {
                    color: #00D9FF;
                    font-size: 42px;
                    margin-bottom: 10px;
                    text-shadow: 0 0 30px rgba(0, 217, 255, 0.5);
                }
                .version {
                    color: #FF9B5A;
                    font-size: 14px;
                    margin-bottom: 30px;
                }
                p {
                    color: #B0B0B0;
                    font-size: 18px;
                    margin-bottom: 40px;
                    line-height: 1.6;
                }
                .buttons {
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                a {
                    padding: 15px 30px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    display: inline-block;
                }
                .primary {
                    background: linear-gradient(135deg, #00D9FF 0%, #4A9FFF 100%);
                    color: #0A1628;
                    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4);
                }
                .primary:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 6px 25px rgba(0, 217, 255, 0.5);
                }
                .secondary {
                    background: transparent;
                    border: 2px solid #00D9FF;
                    color: #00D9FF;
                }
                .secondary:hover {
                    background: rgba(0, 217, 255, 0.1);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <img src="/assets/logo.jpg" alt="Anime Subindo API">
                <h1>Anime Subindo API</h1>
                <p class="version">v1.0.0</p>
                <p>Enterprise-grade anime data API with streaming mirrors and download links</p>
                <div class="buttons">
                    <a href="/ui" class="primary">📚 API Documentation</a>
                    <a href="/api/ongoing?page=1" class="secondary">🚀 Try API</a>
                </div>
            </div>
        </body>
        </html>
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
