/**
 * 日常编辑主面：layout + bootstrap（ApiEnvelope）。
 * 发布冻结包见 publish-routes。
 */
import type { Express, Response } from 'express'
import { buildContainerBootstrap, buildSceneBootstrap } from './bootstrap.js'
import { failEnvelope, okEnvelope } from './api-envelope.js'
import { asyncRoute } from './http.js'
import {
  deleteNamespacedDocument,
  getCommBundle,
  getNamespacedDocument,
  listNamespacedDocuments,
  saveCommBundle,
  saveNamespacedDocument,
  type DocumentNamespace
} from './store.js'

type LayoutPutBody = {
  id?: unknown
  name?: unknown
  document?: unknown
}

function layoutPayload(
  id: string,
  rec: Awaited<ReturnType<typeof getNamespacedDocument>>
) {
  const doc = rec?.json ?? null
  const name =
    rec?.name ?? (doc && typeof doc.name === 'string' ? doc.name : null)
  return { id, name, document: doc }
}

async function handleGetLayout(ns: DocumentNamespace, id: string, res: Response) {
  const rec = await getNamespacedDocument(ns, id)
  res.json(okEnvelope(layoutPayload(id, rec)))
}

async function handlePutLayout(
  ns: DocumentNamespace,
  id: string,
  body: unknown,
  res: Response
) {
  if (!body || typeof body !== 'object') {
    res.status(200).json(failEnvelope(400, 'body required'))
    return
  }
  const { id: bodyId, name, document } = body as LayoutPutBody
  if (bodyId == null || String(bodyId) !== id) {
    res.status(200).json(failEnvelope(400, 'body.id must match path id'))
    return
  }
  if (!document || typeof document !== 'object') {
    res.status(200).json(failEnvelope(400, 'body.document required'))
    return
  }
  const doc = document as Record<string, unknown>
  if (String(doc.id) !== id) {
    res.status(200).json(failEnvelope(400, 'document.id must match path id'))
    return
  }
  try {
    const rec = await saveNamespacedDocument(
      ns,
      id,
      doc,
      typeof name === 'string' ? name : undefined
    )
    res.json(
      okEnvelope({
        id,
        name: rec.name ?? String(rec.json.name ?? id),
        document: rec.json
      })
    )
  } catch (err) {
    const e = err as Error & { status?: number }
    res.status(200).json(failEnvelope(e.status ?? 400, e.message))
  }
}

export function registerEditorRoutes(app: Express): void {
  /** demo 管理页列表（非生产主路径） */
  app.get(
    '/api/editor/scenes',
    asyncRoute(async (_req, res) => {
      res.json(okEnvelope({ items: await listNamespacedDocuments('scene') }))
    })
  )

  app.get(
    '/api/editor/containers',
    asyncRoute(async (_req, res) => {
      res.json(okEnvelope({ items: await listNamespacedDocuments('container') }))
    })
  )

  app.get(
    '/api/editor/scenes/:id/layout',
    asyncRoute(async (req, res) => {
      await handleGetLayout('scene', req.params.id, res)
    })
  )

  app.put(
    '/api/editor/scenes/:id/layout',
    asyncRoute(async (req, res) => {
      await handlePutLayout('scene', req.params.id, req.body, res)
    })
  )

  app.delete(
    '/api/editor/scenes/:id/layout',
    asyncRoute(async (req, res) => {
      const ok = await deleteNamespacedDocument('scene', req.params.id)
      if (!ok) {
        res.status(404).json({ error: 'scene layout not found' })
        return
      }
      res.json({ ok: true })
    })
  )

  app.get(
    '/api/editor/scenes/:id/bootstrap',
    asyncRoute(async (req, res) => {
      const data = await buildSceneBootstrap(req.params.id)
      res.json(okEnvelope(data))
    })
  )

  app.get(
    '/api/editor/containers/:id/layout',
    asyncRoute(async (req, res) => {
      await handleGetLayout('container', req.params.id, res)
    })
  )

  app.put(
    '/api/editor/containers/:id/layout',
    asyncRoute(async (req, res) => {
      await handlePutLayout('container', req.params.id, req.body, res)
    })
  )

  app.delete(
    '/api/editor/containers/:id/layout',
    asyncRoute(async (req, res) => {
      const ok = await deleteNamespacedDocument('container', req.params.id)
      if (!ok) {
        res.status(404).json({ error: 'container layout not found' })
        return
      }
      res.json({ ok: true })
    })
  )

  app.get(
    '/api/editor/containers/:id/bootstrap',
    asyncRoute(async (req, res) => {
      const data = await buildContainerBootstrap(req.params.id)
      res.json(okEnvelope(data))
    })
  )

  app.get(
    '/api/comm',
    asyncRoute(async (_req, res) => {
      res.json(okEnvelope(await getCommBundle()))
    })
  )

  app.put(
    '/api/comm',
    asyncRoute(async (req, res) => {
      const body = req.body
      if (!body || typeof body !== 'object') {
        res.status(200).json(failEnvelope(400, 'body required'))
        return
      }
      const rec = body as { version?: unknown; sources?: unknown }
      if (rec.version !== 1 || !Array.isArray(rec.sources)) {
        res.status(200).json(failEnvelope(400, 'body.version must be 1 and body.sources must be an array'))
        return
      }
      res.json(okEnvelope(await saveCommBundle({ version: 1, sources: rec.sources })))
    })
  )
}
