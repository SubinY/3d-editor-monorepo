import type { CatalogItem, EditorDocumentJSON, PublishBundle } from '@mh/3d-editor'

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

export interface AppSettings {
  homeSceneId: string | null
}

export interface HomePublishBundle extends PublishBundle {
  sceneId: string
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

export async function listCatalog(options?: {
  placeableIn?: string
  latestOnly?: boolean
}): Promise<CatalogItem[]> {
  const params = new URLSearchParams()
  if (options?.placeableIn) params.set('placeableIn', options.placeableIn)
  if (options?.latestOnly) params.set('latestOnly', '1')
  const q = params.toString()
  return request(`/catalog${q ? `?${q}` : ''}`)
}

export async function getCatalogLatest(id: string): Promise<CatalogItem | undefined> {
  try {
    return await request(`/catalog/${encodeURIComponent(id)}`)
  } catch {
    return undefined
  }
}

export async function getCatalogVersion(
  id: string,
  version: string
): Promise<CatalogItem | undefined> {
  try {
    return await request(`/catalog/${encodeURIComponent(id)}/${encodeURIComponent(version)}`)
  } catch {
    return undefined
  }
}

export async function listCatalogVersions(id: string): Promise<string[]> {
  return request(`/catalog/${encodeURIComponent(id)}/versions`)
}

export async function putCatalogItem(item: CatalogItem): Promise<CatalogItem> {
  return request(`/catalog/${encodeURIComponent(item.id)}/${encodeURIComponent(item.version)}`, {
    method: 'PUT',
    body: JSON.stringify(item)
  })
}

export async function postCatalogItem(item: CatalogItem): Promise<CatalogItem> {
  return request('/catalog', {
    method: 'POST',
    body: JSON.stringify(item)
  })
}

export async function deleteCatalogItem(id: string, version?: string): Promise<void> {
  const path = version
    ? `/catalog/${encodeURIComponent(id)}/${encodeURIComponent(version)}`
    : `/catalog/${encodeURIComponent(id)}`
  await request(path, { method: 'DELETE' })
}

export async function publishScene(sceneId: string, bundle: PublishBundle): Promise<PublishBundle> {
  return request(`/scenes/${encodeURIComponent(sceneId)}/publish`, {
    method: 'POST',
    body: JSON.stringify(bundle)
  })
}

export async function getPublish(sceneId: string): Promise<PublishBundle | undefined> {
  try {
    return await request(`/publishes/${encodeURIComponent(sceneId)}`)
  } catch {
    return undefined
  }
}

export async function getHomePublish(): Promise<HomePublishBundle | undefined> {
  try {
    return await request('/publishes/home')
  } catch {
    return undefined
  }
}

export async function getSettings(): Promise<AppSettings> {
  return request('/settings')
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
}

// —— AI model factory ——

export interface ModelFactoryGenerateResult {
  draftId: string
  sourceCode: string
  footprintHint: { width: number; depth: number; height: number }
  name: string
  inventory?: {
    objectClass: string
    identityFeatures: string[]
    parts: Array<{ id: string; role: string; notes?: string }>
    footprintMeters: { width: number; depth: number; height: number }
    labels: string[]
  }
  objectClass?: string
  partCount?: number
}

export interface ModelFactoryDraft {
  id: string
  name: string
  sourceCode: string
  footprintHint: { width: number; depth: number; height: number }
  createdAt: number
  updatedAt: number
}

export async function generateModelFactory(body: {
  imageBase64: string
  mimeType: string
  name?: string
  footprint: { width: number; depth: number; height: number }
}): Promise<ModelFactoryGenerateResult> {
  return request('/ai/model-factory/generate', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export async function getModelFactoryDraft(id: string): Promise<ModelFactoryDraft> {
  return request(`/ai/model-factory/drafts/${encodeURIComponent(id)}`)
}

export async function updateModelFactoryDraft(
  id: string,
  patch: {
    sourceCode?: string
    name?: string
    footprintHint?: { width: number; depth: number; height: number }
  }
): Promise<ModelFactoryDraft> {
  return request(`/ai/model-factory/drafts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  })
}

export async function previewModelFactory(draftId: string): Promise<{ url: string }> {
  return request('/ai/model-factory/preview-build', {
    method: 'POST',
    body: JSON.stringify({ draftId })
  })
}

export async function publishModelFactory(body: {
  draftId: string
  id: string
  version: string
}): Promise<{ url: string; catalogItem: CatalogItem }> {
  return request('/ai/model-factory/publish', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}
