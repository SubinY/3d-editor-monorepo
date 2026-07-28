import type { CatalogItem, EditorDocumentJSON, PublishBundle } from '@3d-editor/editor'

const BASE = '/api'

export interface DocumentRecord {
  json: EditorDocumentJSON
  updatedAt: number
}

export interface AppSettings {
  homeSceneId: string | null
}

export interface HomePublishBundle extends PublishBundle {
  sceneId: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function listDocuments(kind?: 'scene' | 'container'): Promise<DocumentRecord[]> {
  const q = kind ? `?kind=${kind}` : ''
  return request(`/documents${q}`)
}

export async function getDocument(id: string): Promise<DocumentRecord | undefined> {
  try {
    return await request(`/documents/${encodeURIComponent(id)}`)
  } catch {
    return undefined
  }
}

export async function saveDocument(json: EditorDocumentJSON): Promise<DocumentRecord> {
  return request(`/documents/${encodeURIComponent(json.id)}`, {
    method: 'PUT',
    body: JSON.stringify(json)
  })
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' })
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
