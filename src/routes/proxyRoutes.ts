import { OpenAPIHono } from '@hono/zod-openapi'
import { getProxyStreamRoute } from '../routeDefs'
import { ProxyController } from '../controllers/ProxyController'

export const registerProxyRoutes = (app: OpenAPIHono) => {
    app.openapi(getProxyStreamRoute, ProxyController.getProxyStream)
}
