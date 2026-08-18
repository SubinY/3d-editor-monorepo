/**
 * 非日常编辑旁路：AI 模型工厂、Catalog CRUD、Publish、Settings。
 * 路径与响应格式保持不变。
 */
import type { Express } from 'express'
import express from 'express'
import { normalizeFootprint } from './ark.js'
import { asyncRoute, logError } from './http.js'
import {
  createDraftFromImage,
  getDraft,
  modelsDir,
  previewBuild,
  publishDraft,
  updateDraftSource
} from './model-factory.js'
import {
  deleteCatalogItem,
  deletePublish,
  getCatalogItem,
  getPublish,
  getSettings,
  listCatalogItems,
  listCatalogVersions,
  listPublishes,
  postCatalogItem,
  putCatalogItem,
  savePublish,
  saveSettings,
  type PublishBundleRecord
} from './store.js'

export function registerSideRoutes(app: Express): void {
  // —— AI model factory ——
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

  app.post(
    '/api/ai/model-factory/publish',
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

  // —— catalog（AI / 演示；业务柜不双写）——
  app.get(
    '/api/catalog',
    asyncRoute(async (req, res) => {
      const placeableIn =
        typeof req.query.placeableIn === 'string' ? req.query.placeableIn : undefined
      const latestOnly = req.query.latestOnly === '1' || req.query.latestOnly === 'true'
      const items = await listCatalogItems({ placeableIn, latestOnly })
      res.json(items)
    })
  )

  app.get(
    '/api/catalog/:id/versions',
    asyncRoute(async (req, res) => {
      const versions = await listCatalogVersions(req.params.id)
      res.json(versions)
    })
  )

  app.get(
    '/api/catalog/:id/:version',
    asyncRoute(async (req, res) => {
      const item = await getCatalogItem(req.params.id, req.params.version)
      if (!item) {
        res.status(404).json({ error: 'catalog item not found' })
        return
      }
      res.json(item)
    })
  )

  app.get(
    '/api/catalog/:id',
    asyncRoute(async (req, res) => {
      const item = await getCatalogItem(req.params.id)
      if (!item) {
        res.status(404).json({ error: 'catalog item not found' })
        return
      }
      res.json(item)
    })
  )

  app.put(
    '/api/catalog/:id/:version',
    asyncRoute(async (req, res) => {
      try {
        const item = { ...req.body, id: req.params.id, version: req.params.version }
        const saved = await putCatalogItem(item)
        res.json(saved)
      } catch (err) {
        const e = err as Error & { status?: number }
        logError('catalog.put', err, req)
        res.status(e.status ?? 500).json({ error: e.message })
      }
    })
  )

  app.post(
    '/api/catalog',
    asyncRoute(async (req, res) => {
      try {
        const saved = await postCatalogItem(req.body)
        res.status(201).json(saved)
      } catch (err) {
        const e = err as Error & { status?: number }
        logError('catalog.post', err, req)
        res.status(e.status ?? 500).json({ error: e.message })
      }
    })
  )

  app.delete(
    '/api/catalog/:id/:version',
    asyncRoute(async (req, res) => {
      const n = await deleteCatalogItem(req.params.id, req.params.version)
      if (!n) {
        res.status(404).json({ error: 'catalog item not found' })
        return
      }
      res.json({ ok: true, removed: n })
    })
  )

  app.delete(
    '/api/catalog/:id',
    asyncRoute(async (req, res) => {
      const n = await deleteCatalogItem(req.params.id)
      if (!n) {
        res.status(404).json({ error: 'catalog item not found' })
        return
      }
      res.json({ ok: true, removed: n })
    })
  )

  // —— publish ——
  app.post(
    '/api/scenes/:id/publish',
    asyncRoute(async (req, res) => {
      const body = req.body as Partial<PublishBundleRecord>
      if (!body?.document || !body?.assetPack) {
        res.status(400).json({ error: 'document and assetPack required' })
        return
      }
      const doc = body.document as Record<string, unknown>
      if (doc.id !== req.params.id) {
        res.status(400).json({ error: 'document.id must match scene id' })
        return
      }
      const bundle: PublishBundleRecord = {
        document: body.document,
        assetPack: body.assetPack,
        publishedAt: Date.now(),
        name: body.name ?? String(doc.name ?? req.params.id)
      }
      const saved = await savePublish(req.params.id, bundle)
      res.json(saved)
    })
  )

  app.get(
    '/api/publishes',
    asyncRoute(async (_req, res) => {
      res.json(await listPublishes())
    })
  )

  app.get(
    '/api/publishes/home',
    asyncRoute(async (_req, res) => {
      const settings = await getSettings()
      if (!settings.homeSceneId) {
        res.status(404).json({ error: 'no home scene configured' })
        return
      }
      const bundle = await getPublish(settings.homeSceneId)
      if (!bundle) {
        res.status(404).json({ error: 'home publish not found' })
        return
      }
      res.json({ ...bundle, sceneId: settings.homeSceneId })
    })
  )

  app.get(
    '/api/publishes/:id',
    asyncRoute(async (req, res) => {
      const bundle = await getPublish(req.params.id)
      if (!bundle) {
        res.status(404).json({ error: 'publish not found' })
        return
      }
      res.json(bundle)
    })
  )

  app.delete(
    '/api/publishes/:id',
    asyncRoute(async (req, res) => {
      const ok = await deletePublish(req.params.id)
      if (!ok) {
        res.status(404).json({ error: 'publish not found' })
        return
      }
      const settings = await getSettings()
      if (settings.homeSceneId === req.params.id) {
        await saveSettings({ homeSceneId: null })
      }
      res.json({ ok: true })
    })
  )

  // —— settings ——
  app.get(
    '/api/settings',
    asyncRoute(async (_req, res) => {
      res.json(await getSettings())
    })
  )

  app.put(
    '/api/settings',
    asyncRoute(async (req, res) => {
      const homeSceneId =
        req.body?.homeSceneId === undefined
          ? (await getSettings()).homeSceneId
          : req.body.homeSceneId
      if (homeSceneId !== null && typeof homeSceneId !== 'string') {
        res.status(400).json({ error: 'homeSceneId must be string or null' })
        return
      }
      if (typeof homeSceneId === 'string') {
        const pub = await getPublish(homeSceneId)
        if (!pub) {
          res.status(400).json({ error: 'home scene must be published first' })
          return
        }
      }
      const saved = await saveSettings({ homeSceneId })
      res.json(saved)
    })
  )
}
