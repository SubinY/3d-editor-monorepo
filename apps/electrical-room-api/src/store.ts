import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_ROOT = path.resolve(__dirname, '../data')

const DOCS_DIR = path.join(DATA_ROOT, 'documents')
const SCENES_DIR = path.join(DOCS_DIR, 'scenes')
const CONTAINERS_DIR = path.join(DOCS_DIR, 'containers')
const PUBLISHES_DIR = path.join(DATA_ROOT, 'publishes')
const COMM_PATH = path.join(DATA_ROOT, 'comm.json')
const ASSET_DRAFTS_DIR = path.join(DATA_ROOT, 'asset-drafts')
const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads')

export interface CommBundleRecord {
  version: 1
  sources: unknown[]
}

export type DocumentNamespace = 'scene' | 'container'

export interface DocumentRecord {
  json: Record<string, unknown>
  updatedAt: number
  /** 业务展示名；与 document.name 对齐 */
  name?: string
}

/** 与内核 PublishBundle 对齐的落盘形状；version 为场景内自增发布号 */
export interface PublishBundleRecord {
  document: Record<string, unknown>
  assetPack: Record<string, unknown>
  publishedAt: number
  name: string
  sceneId: string
  version: number
}

export interface PublishVersionMeta {
  sceneId: string
  version: number
  publishedAt: number
  name: string
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(SCENES_DIR, { recursive: true })
  await fs.mkdir(CONTAINERS_DIR, { recursive: true })
  await fs.mkdir(PUBLISHES_DIR, { recursive: true })
  await fs.mkdir(ASSET_DRAFTS_DIR, { recursive: true })
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
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

export async function getCommBundle(): Promise<CommBundleRecord> {
  await ensureDirs()
  const rec = await readJson<CommBundleRecord>(COMM_PATH)
  if (!rec || rec.version !== 1 || !Array.isArray(rec.sources)) {
    return { version: 1, sources: [] }
  }
  return rec
}

export async function saveCommBundle(bundle: CommBundleRecord): Promise<CommBundleRecord> {
  await ensureDirs()
  const next: CommBundleRecord = { version: 1, sources: bundle.sources }
  await writeJson(COMM_PATH, next)
  return next
}

function publishSceneDir(sceneId: string): string {
  return path.join(PUBLISHES_DIR, sceneId)
}

function publishVersionPath(sceneId: string, version: number): string {
  return path.join(publishSceneDir(sceneId), `${version}.json`)
}

async function listVersionNumbers(sceneId: string): Promise<number[]> {
  await ensureDirs()
  let files: string[]
  try {
    files = await fs.readdir(publishSceneDir(sceneId))
  } catch {
    return []
  }
  const versions: number[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const n = Number(file.slice(0, -5))
    if (Number.isInteger(n) && n > 0) versions.push(n)
  }
  return versions.sort((a, b) => a - b)
}

export async function savePublish(
  sceneId: string,
  input: {
    document: Record<string, unknown>
    assetPack: Record<string, unknown>
    name: string
  }
): Promise<PublishBundleRecord> {
  await ensureDirs()
  const existing = await listVersionNumbers(sceneId)
  const version = (existing[existing.length - 1] ?? 0) + 1
  const bundle: PublishBundleRecord = {
    document: input.document,
    assetPack: input.assetPack,
    publishedAt: Date.now(),
    name: input.name,
    sceneId,
    version
  }
  await writeJson(publishVersionPath(sceneId, version), bundle)
  return bundle
}

export async function getPublish(
  sceneId: string,
  version: number
): Promise<PublishBundleRecord | undefined> {
  await ensureDirs()
  if (!Number.isInteger(version) || version <= 0) return undefined
  return readJson<PublishBundleRecord>(publishVersionPath(sceneId, version))
}

export async function getLatestPublish(
  sceneId: string
): Promise<PublishBundleRecord | undefined> {
  const versions = await listVersionNumbers(sceneId)
  const latest = versions[versions.length - 1]
  if (latest == null) return undefined
  return getPublish(sceneId, latest)
}

export async function listPublishVersions(sceneId: string): Promise<PublishVersionMeta[]> {
  const versions = await listVersionNumbers(sceneId)
  const items: PublishVersionMeta[] = []
  for (const version of versions) {
    const rec = await getPublish(sceneId, version)
    if (!rec) continue
    items.push({
      sceneId,
      version: rec.version,
      publishedAt: rec.publishedAt,
      name: rec.name
    })
  }
  return items.sort((a, b) => b.version - a.version)
}

/** 各场景最新发布元信息（列表页用） */
export async function listLatestPublishMeta(): Promise<PublishVersionMeta[]> {
  await ensureDirs()
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(PUBLISHES_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  const items: PublishVersionMeta[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const latest = await getLatestPublish(entry.name)
    if (!latest) continue
    items.push({
      sceneId: entry.name,
      version: latest.version,
      publishedAt: latest.publishedAt,
      name: latest.name
    })
  }
  return items
}

export async function deletePublish(sceneId: string, version?: number): Promise<boolean> {
  await ensureDirs()
  try {
    if (version != null) {
      await fs.unlink(publishVersionPath(sceneId, version))
      return true
    }
    await fs.rm(publishSceneDir(sceneId), { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

/** Host「我的素材」草稿 CatalogItem（不进默认白名单） */
export type AssetDraftItem = Record<string, unknown> & {
  id: string
  version: string
  name: string
}

function assetDraftPath(id: string, version: string): string {
  const safeId = id.replace(/[^\w.-]+/g, '_')
  const safeVer = version.replace(/[^\w.-]+/g, '_')
  return path.join(ASSET_DRAFTS_DIR, `${safeId}@${safeVer}.json`)
}

export function uploadsDir(): string {
  return UPLOADS_DIR
}

export async function listAssetDrafts(): Promise<AssetDraftItem[]> {
  await ensureDirs()
  let files: string[]
  try {
    files = await fs.readdir(ASSET_DRAFTS_DIR)
  } catch {
    return []
  }
  const items: AssetDraftItem[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const rec = await readJson<AssetDraftItem>(path.join(ASSET_DRAFTS_DIR, file))
    if (!rec?.id || !rec.version) continue
    items.push(rec)
  }
  return items.sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export async function getAssetDraft(
  id: string,
  version?: string
): Promise<AssetDraftItem | undefined> {
  await ensureDirs()
  if (version) {
    return readJson<AssetDraftItem>(assetDraftPath(id, version))
  }
  const all = await listAssetDrafts()
  const matches = all.filter(item => item.id === id)
  return matches[matches.length - 1]
}

export async function saveAssetDraft(item: AssetDraftItem): Promise<AssetDraftItem> {
  await ensureDirs()
  if (!item.id || !item.version) {
    throw Object.assign(new Error('id and version required'), { status: 400 })
  }
  await writeJson(assetDraftPath(item.id, item.version), item)
  return item
}

export async function deleteAssetDraft(id: string, version?: string): Promise<boolean> {
  await ensureDirs()
  try {
    if (version) {
      await fs.unlink(assetDraftPath(id, version))
      return true
    }
    const all = await listAssetDrafts()
    let deleted = false
    for (const item of all) {
      if (item.id !== id) continue
      await fs.unlink(assetDraftPath(item.id, item.version))
      deleted = true
    }
    return deleted
  } catch {
    return false
  }
}

export async function saveUploadFile(input: {
  filename: string
  data: Buffer
}): Promise<{ url: string; filename: string }> {
  await ensureDirs()
  const base = path.basename(input.filename).replace(/[^\w.\-]+/g, '_')
  if (!base) {
    throw Object.assign(new Error('filename required'), { status: 400 })
  }
  const lower = base.toLowerCase()
  if (!lower.endsWith('.glb') && !lower.endsWith('.gltf') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg') && !lower.endsWith('.png')) {
    throw Object.assign(new Error('only .glb / .gltf / .jpg / .jpeg / .png allowed'), { status: 400 })
  }
  const stamp = Date.now().toString(36)
  const stored = `${stamp}-${base}`
  await fs.writeFile(path.join(UPLOADS_DIR, stored), input.data)
  return { url: `/uploads/${stored}`, filename: stored }
}

export function resolveUploadFilename(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null
  const name = path.basename(decodeURIComponent(url.slice('/uploads/'.length)))
  if (!name || name.includes('..')) return null
  return name
}

export async function readUploadFile(filename: string): Promise<Buffer | null> {
  const safe = path.basename(filename)
  try {
    return await fs.readFile(path.join(UPLOADS_DIR, safe))
  } catch {
    return null
  }
}
