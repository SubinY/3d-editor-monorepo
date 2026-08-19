/**
 * 发布冻结包（多版本）：
 * - POST 自增 version 落盘
 * - GET 纯 JSON 包 / 版本列表
 */
import type { Express } from 'express'
import { failEnvelope, okEnvelope } from './api-envelope.js'
import { asyncRoute } from './http.js'
import {
  getLatestPublish,
  getPublish,
  listLatestPublishMeta,
  listPublishVersions,
  savePublish
} from './store.js'

export function registerPublishRoutes(app: Express): void {
  app.post(
    '/api/editor/scenes/:id/publish',
    asyncRoute(async (req, res) => {
      const body = req.body as {
        document?: Record<string, unknown>
        assetPack?: Record<string, unknown>
        name?: string
      } | null
      if (!body?.document || !body?.assetPack) {
        res.status(200).json(failEnvelope(400, 'document and assetPack required'))
        return
      }
      const doc = body.document
      if (String(doc.id) !== req.params.id) {
        res.status(200).json(failEnvelope(400, 'document.id must match scene id'))
        return
      }
      if (doc.kind !== 'scene') {
        res.status(200).json(failEnvelope(400, 'document.kind must be scene'))
        return
      }
      const saved = await savePublish(req.params.id, {
        document: body.document,
        assetPack: body.assetPack,
        name: body.name ?? String(doc.name ?? req.params.id)
      })
      res.json(okEnvelope(saved))
    })
  )

  /** 各场景最新发布摘要 */
  app.get(
    '/api/publishes',
    asyncRoute(async (_req, res) => {
      res.json(okEnvelope({ items: await listLatestPublishMeta() }))
    })
  )

  app.get(
    '/api/publishes/:sceneId/versions',
    asyncRoute(async (req, res) => {
      res.json(okEnvelope({ items: await listPublishVersions(req.params.sceneId) }))
    })
  )

  /** 纯 JSON：指定版本；无 version 段时取最新 */
  app.get(
    '/api/publishes/:sceneId/:version',
    asyncRoute(async (req, res) => {
      const version = Number(req.params.version)
      if (!Number.isInteger(version) || version <= 0) {
        res.status(400).json({ error: 'invalid version' })
        return
      }
      const bundle = await getPublish(req.params.sceneId, version)
      if (!bundle) {
        res.status(404).json({ error: 'publish not found' })
        return
      }
      res.json(bundle)
    })
  )

  app.get(
    '/api/publishes/:sceneId',
    asyncRoute(async (req, res) => {
      const bundle = await getLatestPublish(req.params.sceneId)
      if (!bundle) {
        res.status(404).json({ error: 'publish not found' })
        return
      }
      res.json(bundle)
    })
  )
}
