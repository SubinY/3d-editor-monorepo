/**
 * P1 资产入库：上传 GLB、我的素材草稿、AI model-factory（不进默认盘）。
 */
import type { Express } from 'express'
import express from 'express'
import { normalizeFootprint } from './ark.js'
import { asyncRoute, logError } from './http.js'
import {
  createDraftFromImage,
  getDraft,
  initModelFactoryStore,
  modelsDir,
  previewBuild,
  publishDraft,
  updateDraftSource
} from './model-factory.js'
import {
  deleteAssetDraft,
  getAssetDraft,
  listAssetDrafts,
  saveAssetDraft,
  saveUploadFile,
  uploadsDir,
  type AssetDraftItem
} from './store.js'

export async function registerAssetRoutes(app: Express): Promise<void> {
  await initModelFactoryStore()

  app.use(
    '/uploads',
    express.static(uploadsDir(), {
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=3600')
      }
    })
  )

  app.use(
    '/models',
    express.static(modelsDir(), {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        }
        res.setHeader('Cache-Control', 'no-cache')
      }
    })
  )

  app.get(
    '/api/asset-drafts',
    asyncRoute(async (_req, res) => {
      const items = await listAssetDrafts()
      res.json({ items })
    })
  )

  app.get(
    '/api/asset-drafts/:id',
    asyncRoute(async (req, res) => {
      const version = typeof req.query.version === 'string' ? req.query.version : undefined
      const item = await getAssetDraft(req.params.id, version)
      if (!item) {
        res.status(404).json({ error: 'asset draft not found' })
        return
      }
      res.json(item)
    })
  )

  app.post(
    '/api/asset-drafts',
    asyncRoute(async (req, res) => {
      const body = req.body as AssetDraftItem
      if (!body?.id || !body?.version || !body?.name) {
        res.status(400).json({ error: 'id, version, name required' })
        return
      }
      const saved = await saveAssetDraft(body)
      res.status(201).json(saved)
    })
  )

  app.put(
    '/api/asset-drafts/:id/:version',
    asyncRoute(async (req, res) => {
      const item = {
        ...(req.body as AssetDraftItem),
        id: req.params.id,
        version: req.params.version
      }
      if (!item.name) {
        res.status(400).json({ error: 'name required' })
        return
      }
      const saved = await saveAssetDraft(item)
      res.json(saved)
    })
  )

  app.delete(
    '/api/asset-drafts/:id',
    asyncRoute(async (req, res) => {
      const version = typeof req.query.version === 'string' ? req.query.version : undefined
      const ok = await deleteAssetDraft(req.params.id, version)
      if (!ok) {
        res.status(404).json({ error: 'asset draft not found' })
        return
      }
      res.status(204).end()
    })
  )

  app.post(
    '/api/assets/upload',
    asyncRoute(async (req, res) => {
      const { filename, dataBase64 } = req.body ?? {}
      if (!filename || typeof filename !== 'string') {
        res.status(400).json({ error: 'filename required' })
        return
      }
      if (!dataBase64 || typeof dataBase64 !== 'string') {
        res.status(400).json({ error: 'dataBase64 required' })
        return
      }
      const raw = dataBase64.includes(',') ? dataBase64.split(',')[1]! : dataBase64
      let data: Buffer
      try {
        data = Buffer.from(raw, 'base64')
      } catch {
        res.status(400).json({ error: 'invalid base64' })
        return
      }
      if (data.length === 0) {
        res.status(400).json({ error: 'empty file' })
        return
      }
      if (data.length > 40 * 1024 * 1024) {
        res.status(400).json({ error: 'file too large (max 40MB)' })
        return
      }
      try {
        const out = await saveUploadFile({ filename, data })
        res.status(201).json(out)
      } catch (err) {
        const e = err as Error & { status?: number }
        logError('assets.upload', err, req)
        res.status(e.status ?? 500).json({ error: e.message })
      }
    })
  )

  // —— AI model factory（生成 → 预览；不写默认盘）——
  app.post(
    '/api/ai/model-factory/generate',
    asyncRoute(async (req, res) => {
      const { imageBase64, mimeType, name, footprint } = req.body ?? {}
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'imageBase64 required' })
        return
      }
      let fp: { width: number; depth: number; height: number }
      try {
        fp = normalizeFootprint(footprint)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        res.status(400).json({ error: msg })
        return
      }
      const draft = await createDraftFromImage({
        imageBase64,
        mimeType: typeof mimeType === 'string' ? mimeType : 'image/png',
        name: typeof name === 'string' ? name : undefined,
        footprint: fp
      })
      res.status(201).json({
        draftId: draft.id,
        sourceCode: draft.sourceCode,
        footprintHint: draft.footprintHint,
        name: draft.name,
        inventory: draft.inventory,
        objectClass: draft.inventory?.objectClass,
        partCount: draft.inventory?.parts?.length ?? 0
      })
    })
  )

  app.get(
    '/api/ai/model-factory/drafts/:id',
    asyncRoute(async (req, res) => {
      const draft = await getDraft(req.params.id)
      if (!draft) {
        res.status(404).json({ error: 'draft not found' })
        return
      }
      res.json(draft)
    })
  )

  app.put(
    '/api/ai/model-factory/drafts/:id',
    asyncRoute(async (req, res) => {
      const draft = await updateDraftSource(req.params.id, {
        sourceCode: req.body?.sourceCode,
        name: req.body?.name,
        footprintHint: req.body?.footprintHint
      })
      res.json(draft)
    })
  )

  app.post(
    '/api/ai/model-factory/preview-build',
    asyncRoute(async (req, res) => {
      const draftId = req.body?.draftId
      if (!draftId || typeof draftId !== 'string') {
        res.status(400).json({ error: 'draftId required' })
        return
      }
      const out = await previewBuild(draftId)
      res.json(out)
    })
  )

  /** 编译到 /models；返回 CatalogItem 形状，由 Host 写入 asset-drafts */
  app.post(
    '/api/ai/model-factory/compile',
    asyncRoute(async (req, res) => {
      const { draftId, id, version } = req.body ?? {}
      if (!draftId || !id) {
        res.status(400).json({ error: 'draftId and id required' })
        return
      }
      const out = await publishDraft({
        draftId: String(draftId),
        id: String(id),
        version: typeof version === 'string' ? version : '1.0.0'
      })
      res.status(201).json(out)
    })
  )
}
