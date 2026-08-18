import express from 'express'
import cors from 'cors'
import { registerEditorRoutes } from './editor-routes.js'
import { loadDotEnv } from './env.js'
import { unhandledErrorMiddleware } from './http.js'
import { initModelFactoryStore } from './model-factory.js'
import { registerSideRoutes } from './side-routes.js'
import { initStore } from './store.js'
import { attachTwinWebSocket, registerTwinHttpRoutes } from './twin-routes.js'

loadDotEnv()

const PORT = Number(process.env.PORT) || 8787

async function main() {
  await initStore()
  await initModelFactoryStore()
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '20mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  // 日常编辑：layout + bootstrap
  registerEditorRoutes(app)
  // AI / Catalog / Publish / Settings（演示旁路，路径不变）
  registerSideRoutes(app)
  // 孪生点位模拟（HTTP + 由 listen 后挂 WS）
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
