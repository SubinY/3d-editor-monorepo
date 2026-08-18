import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_ROOT = path.resolve(__dirname, '../data')

const DOCS_DIR = path.join(DATA_ROOT, 'documents')
const SCENES_DIR = path.join(DOCS_DIR, 'scenes')
const CONTAINERS_DIR = path.join(DOCS_DIR, 'containers')
const CATALOG_DIR = path.join(DATA_ROOT, 'catalog')
const PUBLISHES_DIR = path.join(DATA_ROOT, 'publishes')
const SETTINGS_PATH = path.join(DATA_ROOT, 'settings.json')

export type DocumentNamespace = 'scene' | 'container'

export interface DocumentRecord {
  json: Record<string, unknown>
  updatedAt: number
  /** 业务展示名；与 document.name 对齐 */
  name?: string
}

export interface AppSettings {
  homeSceneId: string | null
}

export interface PublishBundleRecord {
  document: Record<string, unknown>
  assetPack: Record<string, unknown>
  publishedAt: number
  name: string
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(SCENES_DIR, { recursive: true })
  await fs.mkdir(CONTAINERS_DIR, { recursive: true })
  await fs.mkdir(CATALOG_DIR, { recursive: true })
  await fs.mkdir(PUBLISHES_DIR, { recursive: true })
  try {
    await fs.access(SETTINGS_PATH)
  } catch {
    await writeJson(SETTINGS_PATH, { homeSceneId: null } satisfies AppSettings)
  }
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function namespaceDir(ns: DocumentNamespace): string {
  return ns === 'scene' ? SCENES_DIR : CONTAINERS_DIR
}

function namespacedDocPath(ns: DocumentNamespace, id: string): string {
  return path.join(namespaceDir(ns), `${id}.json`)
}

function catalogFileName(id: string, version: string): string {
  return `${id}__${version}.json`
}

function catalogPath(id: string, version: string): string {
  return path.join(CATALOG_DIR, catalogFileName(id, version))
}

function publishPath(sceneId: string): string {
  return path.join(PUBLISHES_DIR, `${sceneId}.json`)
}

function parseCatalogFileName(name: string): { id: string; version: string } | undefined {
  if (!name.endsWith('.json')) return undefined
  const base = name.slice(0, -5)
  const idx = base.lastIndexOf('__')
  if (idx <= 0) return undefined
  return { id: base.slice(0, idx), version: base.slice(idx + 2) }
}

export async function initStore(): Promise<void> {
  await ensureDirs()
}

export async function listNamespacedDocuments(ns: DocumentNamespace): Promise<DocumentRecord[]> {
  await ensureDirs()
  const dir = namespaceDir(ns)
  let files: string[]
  try {
    files = await fs.readdir(dir)
  } catch {
    return []
  }
  const items: DocumentRecord[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const rec = await readJson<DocumentRecord>(path.join(dir, file))
    if (!rec?.json) continue
    if (rec.json.kind !== ns) continue
    items.push(rec)
  }
  return items.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getNamespacedDocument(
  ns: DocumentNamespace,
  id: string
): Promise<DocumentRecord | undefined> {
  await ensureDirs()
  return readJson<DocumentRecord>(namespacedDocPath(ns, id))
}

export async function saveNamespacedDocument(
  ns: DocumentNamespace,
  id: string,
  json: Record<string, unknown>,
  name?: string
): Promise<DocumentRecord> {
  await ensureDirs()
  if (String(json.id) !== id) {
    throw Object.assign(new Error('document.id must match path id'), { status: 400 })
  }
  if (json.kind !== ns) {
    throw Object.assign(new Error(`document.kind must be "${ns}"`), { status: 400 })
  }
  const resolvedName =
    typeof name === 'string' && name.length > 0
      ? name
      : typeof json.name === 'string'
        ? json.name
        : id
  const nextJson = { ...json, name: resolvedName }
  const rec: DocumentRecord = { json: nextJson, name: resolvedName, updatedAt: Date.now() }
  await writeJson(namespacedDocPath(ns, id), rec)
  return rec
}

export async function deleteNamespacedDocument(
  ns: DocumentNamespace,
  id: string
): Promise<boolean> {
  await ensureDirs()
  try {
    await fs.unlink(namespacedDocPath(ns, id))
    return true
  } catch {
    return false
  }
}

export async function listCatalogItems(query?: {
  placeableIn?: string
  latestOnly?: boolean
}): Promise<Array<Record<string, unknown>>> {
  await ensureDirs()
  const files = await fs.readdir(CATALOG_DIR)
  const items: Array<Record<string, unknown>> = []
  for (const file of files) {
    const parsed = parseCatalogFileName(file)
    if (!parsed) continue
    const item = await readJson<Record<string, unknown>>(path.join(CATALOG_DIR, file))
    if (!item) continue
    if (query?.placeableIn) {
      const placeable = item.placeableIn
      if (!Array.isArray(placeable) || !placeable.includes(query.placeableIn)) continue
    }
    items.push(item)
  }

  if (!query?.latestOnly) return items

  const latest = new Map<string, Record<string, unknown>>()
  for (const item of items) {
    const id = String(item.id)
    const version = String(item.version)
    const prev = latest.get(id)
    if (!prev || semver.gt(version, String(prev.version))) {
      latest.set(id, item)
    }
  }
  return Array.from(latest.values())
}

export async function getCatalogItem(
  id: string,
  version?: string
): Promise<Record<string, unknown> | undefined> {
  await ensureDirs()
  if (version) {
    return readJson(catalogPath(id, version))
  }
  const versions = await listCatalogVersions(id)
  if (!versions.length) return undefined
  const latest = versions.sort(semver.rcompare)[0]
  return readJson(catalogPath(id, latest))
}

export async function listCatalogVersions(id: string): Promise<string[]> {
  await ensureDirs()
  const files = await fs.readdir(CATALOG_DIR)
  const versions: string[] = []
  for (const file of files) {
    const parsed = parseCatalogFileName(file)
    if (parsed?.id === id && semver.valid(parsed.version)) {
      versions.push(parsed.version)
    }
  }
  return versions.sort(semver.rcompare)
}

export async function putCatalogItem(item: Record<string, unknown>): Promise<Record<string, unknown>> {
  await ensureDirs()
  const id = String(item.id)
  const version = String(item.version)
  if (!semver.valid(version)) {
    throw Object.assign(new Error(`invalid semver: ${version}`), { status: 400 })
  }
  await writeJson(catalogPath(id, version), item)
  return item
}

export async function postCatalogItem(item: Record<string, unknown>): Promise<Record<string, unknown>> {
  await ensureDirs()
  const id = String(item.id)
  const version = String(item.version)
  if (!semver.valid(version)) {
    throw Object.assign(new Error(`invalid semver: ${version}`), { status: 400 })
  }
  const versions = await listCatalogVersions(id)
  if (versions.length) {
    const latest = versions[0]
    if (!semver.gt(version, latest)) {
      throw Object.assign(
        new Error(`version ${version} must be greater than latest ${latest}`),
        { status: 409 }
      )
    }
  }
  const existing = await getCatalogItem(id, version)
  if (existing) {
    throw Object.assign(new Error(`version ${version} already exists`), { status: 409 })
  }
  await writeJson(catalogPath(id, version), item)
  return item
}

export async function deleteCatalogItem(id: string, version?: string): Promise<number> {
  await ensureDirs()
  const files = await fs.readdir(CATALOG_DIR)
  let removed = 0
  for (const file of files) {
    const parsed = parseCatalogFileName(file)
    if (!parsed || parsed.id !== id) continue
    if (version && parsed.version !== version) continue
    await fs.unlink(path.join(CATALOG_DIR, file))
    removed++
  }
  return removed
}

export async function savePublish(
  sceneId: string,
  bundle: PublishBundleRecord
): Promise<PublishBundleRecord> {
  await ensureDirs()
  await writeJson(publishPath(sceneId), bundle)
  return bundle
}

export async function getPublish(sceneId: string): Promise<PublishBundleRecord | undefined> {
  await ensureDirs()
  return readJson(publishPath(sceneId))
}

export async function deletePublish(sceneId: string): Promise<boolean> {
  await ensureDirs()
  try {
    await fs.unlink(publishPath(sceneId))
    return true
  } catch {
    return false
  }
}

export async function listPublishes(): Promise<PublishBundleRecord[]> {
  await ensureDirs()
  const files = await fs.readdir(PUBLISHES_DIR)
  const items: PublishBundleRecord[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const rec = await readJson<PublishBundleRecord>(path.join(PUBLISHES_DIR, file))
    if (rec) items.push(rec)
  }
  return items.sort((a, b) => b.publishedAt - a.publishedAt)
}

export async function getSettings(): Promise<AppSettings> {
  await ensureDirs()
  return (await readJson<AppSettings>(SETTINGS_PATH)) ?? { homeSceneId: null }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  await ensureDirs()
  await writeJson(SETTINGS_PATH, settings)
  return settings
}
