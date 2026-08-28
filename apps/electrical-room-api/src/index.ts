import express from 'express'
import cors from 'cors'
import { registerAssetRoutes } from './asset-routes.js'
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
  // GLB 走 base64 JSON，体积约 ×4/3；100MB 文件 ≈ 140MB JSON
  app.use(express.json({ limit: '200mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  registerEditorRoutes(app)
  registerPublishRoutes(app)
  registerTwinHttpRoutes(app)
  await registerAssetRoutes(app)

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
