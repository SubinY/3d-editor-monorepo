import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_ROOT = path.resolve(__dirname, '../data')

const DOCS_DIR = path.join(DATA_ROOT, 'documents')
const SCENES_DIR = path.join(DOCS_DIR, 'scenes')
const CONTAINERS_DIR = path.join(DOCS_DIR, 'containers')
const COMM_PATH = path.join(DATA_ROOT, 'comm.json')

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

async function ensureDirs(): Promise<void> {
  await fs.mkdir(SCENES_DIR, { recursive: true })
  await fs.mkdir(CONTAINERS_DIR, { recursive: true })
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
