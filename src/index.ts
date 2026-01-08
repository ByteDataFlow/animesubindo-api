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

// Custom branded Swagger UI (embedded for Vercel compatibility)
app.get('/ui', (c) => {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anime Subindo API - Documentation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <link rel="stylesheet" href="/swagger-custom.css">
    <style>
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
        body { margin: 0; padding: 0; }
        #custom-header {
            background: linear-gradient(135deg, #0A1628 0%, #1A2841 100%);
            border-bottom: 2px solid #00D9FF;
            padding: 24px 48px;
            display: flex;
            align-items: center;
        }
        #custom-header .logo-section { display: flex; align-items: center; gap: 20px; }
        #custom-header img { height: 56px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 217, 255, 0.25); }
        #custom-header .title-group { display: flex; align-items: center; gap: 12px; }
        #custom-header h1 {
            margin: 0; color: #00D9FF; font-size: 24px; font-weight: 600;
            letter-spacing: -0.5px; text-shadow: 0 0 20px rgba(0, 217, 255, 0.3);
        }
        #custom-header .badges { display: flex; gap: 8px; align-items: center; }
        #custom-header .version-badge {
            background: linear-gradient(135deg, #00D9FF 0%, #4A9FFF 100%);
            color: #0A1628; padding: 5px 14px; border-radius: 16px;
            font-size: 12px; font-weight: 600; letter-spacing: 0.3px;
            box-shadow: 0 2px 8px rgba(0, 217, 255, 0.2);
        }
        #custom-header .oas-badge {
            background: #FF9B5A; color: #0A1628; padding: 5px 14px; border-radius: 16px;
            font-size: 12px; font-weight: 600; letter-spacing: 0.3px;
            box-shadow: 0 2px 8px rgba(255, 155, 90, 0.2);
        }
        .swagger-ui .topbar { display: none !important; }
        .swagger-ui .wrapper { padding: 32px 48px !important; max-width: 1400px; margin: 0 auto; }
        .swagger-ui .info { margin: 32px 0 !important; }
    </style>
</head>
<body>
    <div id="custom-header">
        <div class="logo-section">
            <img src="/assets/logo.jpg" alt="Anime Subindo API Logo">
            <div class="title-group">
                <h1>Anime Subindo API</h1>
                <div class="badges">
                    <span class="version-badge">v1.0.0</span>
                    <span class="oas-badge">OAS 3.0</span>
                </div>
            </div>
        </div>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: '/doc',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                plugins: [SwaggerUIBundle.plugins.DownloadUrl],
                layout: "StandaloneLayout",
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 1,
                docExpansion: 'list',
                filter: true,
                showExtensions: true,
                showCommonExtensions: true,
                tryItOutEnabled: true
            });
        };
    </script>
</body>
</html>`)
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
