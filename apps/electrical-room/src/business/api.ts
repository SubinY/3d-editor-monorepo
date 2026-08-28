import type { CatalogItem, EditorDocumentJSON, PublishBundle } from '@mh/3d-editor'
import type { CommBundle } from './comm-types'

const BASE = '/api'
const API_CODE_OK = 0

interface ApiEnvelope<T> {
  code: number
  msg: string | null
  data: T
}

interface LayoutData {
  id: string
  name: string | null
  document: EditorDocumentJSON | null
}

interface ListData {
  items: DocumentRecord[]
}

export interface DocumentRecord {
  json: EditorDocumentJSON
  updatedAt: number
  name?: string
}

export interface SceneBootstrapData {
  document: EditorDocumentJSON | null
  room: { id: string; name: string; length?: number; width?: number; height?: number }
  /** 本 document 引用的柜 layout（key = 业务柜 id）；无档为 null */
  containerLayouts: Record<string, EditorDocumentJSON | null>
}

export interface ContainerBootstrapData {
  document: EditorDocumentJSON | null
  cabinet: { id: string; name: string; length?: number; width?: number; height?: number }
}

function isApiEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  if (typeof body !== 'object' || body === null) return false
  return typeof (body as ApiEnvelope<unknown>).code === 'number'
}

function unwrapResponseData<T>(body: unknown): T {
  if (isApiEnvelope(body)) {
    if (body.code !== API_CODE_OK) {
      throw new Error(body.msg || '请求失败')
    }
    return body.data as T
  }
  return body as T
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string; msg?: string | null }
      if (body.msg) message = body.msg
      else if (body.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return unwrapResponseData<T>(await res.json())
}

function layoutPath(kind: 'scene' | 'container', id: string): string {
  const seg = kind === 'scene' ? 'scenes' : 'containers'
  return `/editor/${seg}/${encodeURIComponent(id)}/layout`
}

function bootstrapPath(kind: 'scene' | 'container', id: string): string {
  const seg = kind === 'scene' ? 'scenes' : 'containers'
  return `/editor/${seg}/${encodeURIComponent(id)}/bootstrap`
}

export async function listScenes(): Promise<DocumentRecord[]> {
  const data = await request<ListData>('/editor/scenes')
  return data.items ?? []
}

export async function listContainers(): Promise<DocumentRecord[]> {
  const data = await request<ListData>('/editor/containers')
  return data.items ?? []
}

export async function getDocument(
  kind: 'scene' | 'container',
  id: string
): Promise<DocumentRecord | undefined> {
  const data = await request<LayoutData>(layoutPath(kind, id))
  if (!data.document) return undefined
  return {
    json: data.document,
    name: data.name ?? undefined,
    updatedAt: Date.now()
  }
}

export async function saveDocument(
  json: EditorDocumentJSON,
  name?: string
): Promise<DocumentRecord> {
  if (json.kind !== 'scene' && json.kind !== 'container') {
    throw new Error('document.kind must be scene or container')
  }
  const resolvedName =
    typeof name === 'string' && name.length > 0 ? name : json.name || json.id
  const data = await request<LayoutData>(layoutPath(json.kind, json.id), {
    method: 'PUT',
    body: JSON.stringify({
      id: json.id,
      name: resolvedName,
      document: json
    })
  })
  if (!data.document) {
    throw new Error('保存失败：响应无文档')
  }
  return {
    json: data.document,
    name: data.name ?? resolvedName,
    updatedAt: Date.now()
  }
}

export async function deleteDocument(kind: 'scene' | 'container', id: string): Promise<void> {
  await request(layoutPath(kind, id), { method: 'DELETE' })
}

export async function fetchSceneBootstrap(roomId: string): Promise<SceneBootstrapData> {
  return request(bootstrapPath('scene', roomId))
}

export async function fetchContainerBootstrap(
  cabinetId: string
): Promise<ContainerBootstrapData> {
  return request(bootstrapPath('container', cabinetId))
}

export async function getCommBundle(): Promise<CommBundle> {
  return request('/comm')
}

export async function putCommBundle(bundle: CommBundle): Promise<CommBundle> {
  return request('/comm', {
    method: 'PUT',
    body: JSON.stringify(bundle)
  })
}

/** 冻结发布包；每次发布自增 version */
export interface PublishedBundle extends PublishBundle {
  sceneId: string
  version: number
  publishedAt: number
  name: string
}

export interface PublishVersionMeta {
  sceneId: string
  version: number
  publishedAt: number
  name: string
}

export async function publishScene(
  sceneId: string,
  bundle: PublishBundle
): Promise<PublishedBundle> {
  return request(`/editor/scenes/${encodeURIComponent(sceneId)}/publish`, {
    method: 'POST',
    body: JSON.stringify(bundle)
  })
}

/** 各场景最新发布摘要 */
export async function listLatestPublishes(): Promise<PublishVersionMeta[]> {
  const data = await request<{ items: PublishVersionMeta[] }>('/publishes')
  return data.items ?? []
}

export async function listPublishVersions(sceneId: string): Promise<PublishVersionMeta[]> {
  const data = await request<{ items: PublishVersionMeta[] }>(
    `/publishes/${encodeURIComponent(sceneId)}/versions`
  )
  return data.items ?? []
}

/** 读取已发布包（GET 无 envelope） */
export async function getPublish(
  sceneId: string,
  version?: number
): Promise<PublishedBundle | undefined> {
  try {
    const suffix =
      version != null
        ? `/${encodeURIComponent(sceneId)}/${version}`
        : `/${encodeURIComponent(sceneId)}`
    return await request(`/publishes${suffix}`)
  } catch {
    return undefined
  }
}

/** 前端 3D 监控页路由 path（hash 路由） */
export function publishedMonitorPath(sceneId: string, version: number): string {
  return `/published/${encodeURIComponent(sceneId)}/${version}`
}

/** 可分享的前端监控页完整 URL */
export function publishedMonitorUrl(sceneId: string, version: number): string {
  const hashPath = publishedMonitorPath(sceneId, version)
  if (typeof window === 'undefined') return `#${hashPath}`
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#${hashPath}`
}

// —— P1 资产草稿 / 上传 / AI ——

export async function listAssetDrafts(): Promise<CatalogItem[]> {
  const data = await request<{ items: CatalogItem[] }>('/asset-drafts')
  return data.items ?? []
}

export async function saveAssetDraft(item: CatalogItem): Promise<CatalogItem> {
  return request('/asset-drafts', {
    method: 'POST',
    body: JSON.stringify(item)
  })
}

export async function deleteAssetDraft(id: string, version?: string): Promise<void> {
  const q = version ? `?version=${encodeURIComponent(version)}` : ''
  await request(`/asset-drafts/${encodeURIComponent(id)}${q}`, { method: 'DELETE' })
}

export interface UploadAssetResult {
  url: string
  filename: string
  bbox?: { width: number; depth: number; height: number }
  trianglesBefore?: number
  trianglesAfter?: number
  textureMax?: number
  warning?: string
}

export async function uploadAssetFile(
  filename: string,
  dataBase64: string
): Promise<UploadAssetResult> {
  return request('/assets/upload', {
    method: 'POST',
    body: JSON.stringify({ filename, dataBase64 })
  })
}

export async function uploadGlbAsset(file: File): Promise<UploadAssetResult> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return uploadAssetFile(file.name, btoa(binary))
}

export async function fitGlbAsset(input: {
  url: string
  filename?: string
  footprint: { width: number; depth: number; height: number }
}): Promise<UploadAssetResult> {
  return request('/assets/fit', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

/** dataURL (image/jpeg|png) → 落盘 url；失败返回 null */
export async function uploadDataUrlAsset(
  dataUrl: string,
  filename: string
): Promise<string | null> {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  try {
    const out = await uploadAssetFile(filename, m[2]!)
    return out.url
  } catch {
    return null
  }
}

export interface ModelFactoryGenerateResult {
  draftId: string
  sourceCode: string
  footprintHint: { width: number; depth: number; height: number }
  name: string
  inventory?: unknown
  objectClass?: string
  partCount?: number
}

export async function generateModelFactory(input: {
  imageBase64: string
  mimeType: string
  name?: string
  footprint: { width: number; depth: number; height: number }
}): Promise<ModelFactoryGenerateResult> {
  return request('/ai/model-factory/generate', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export async function previewBuildModelFactory(draftId: string): Promise<{ url: string }> {
  return request('/ai/model-factory/preview-build', {
    method: 'POST',
    body: JSON.stringify({ draftId })
  })
}

export async function compileModelFactory(input: {
  draftId: string
  id: string
  version: string
}): Promise<{ url: string; catalogItem: CatalogItem }> {
  return request('/ai/model-factory/compile', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}
