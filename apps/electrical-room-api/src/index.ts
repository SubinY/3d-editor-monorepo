import express from 'express'
import cors from 'cors'
import { registerEditorRoutes } from './editor-routes.js'
import { loadDotEnv } from './env.js'
import { unhandledErrorMiddleware } from './http.js'
import { registerPublishRoutes } from './publish-routes.js'
import { initStore } from './store.js'
import { attachTwinWebSocket, registerTwinHttpRoutes } from './twin-routes.js'

loadDotEnv()

const PORT = Number(process.env.PORT) || 8787

async function main() {
  await initStore()
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '20mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  registerEditorRoutes(app)
  registerPublishRoutes(app)
  registerTwinHttpRoutes(app)

  app.use(unhandledErrorMiddleware)

  const server = app.listen(PORT, () => {
    console.log(`[electrical-room-api] http://localhost:${PORT}`)
    console.log(`[electrical-room-api] twin WS ws://localhost:${PORT}/api/twin/ws`)
  })
  attachTwinWebSocket(server)
}

main().catch(err => {
  console.error('[electrical-room-api] fatal startup error:', err)
  process.exit(1)
})
