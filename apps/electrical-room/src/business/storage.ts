import type { DocumentKind, EditorDocumentJSON } from '@3d-editor/editor'

/**
 * 文档存储（MVP：localStorage）。
 * 电柜（container）与电柜室（scene）统一按 id 存放；
 * 保存 container 即视为发布柜资产（catalog.ts 的 savedCabinetItems 会读取）。
 */

const DOCS_KEY = 'electrical-room:documents'

interface DocsMap {
  [id: string]: { json: EditorDocumentJSON; updatedAt: number }
}

function readAll(): DocsMap {
  const raw = localStorage.getItem(DOCS_KEY)
  return raw ? (JSON.parse(raw) as DocsMap) : {}
}

function writeAll(map: DocsMap): void {
  localStorage.setItem(DOCS_KEY, JSON.stringify(map))
}

export function saveDocument(json: EditorDocumentJSON): void {
  const map = readAll()
  map[json.id] = { json, updatedAt: Date.now() }
  writeAll(map)
}

export function getDocument(id: string): EditorDocumentJSON | undefined {
  return readAll()[id]?.json
}

export function getDocumentUpdatedAt(id: string): number | undefined {
  return readAll()[id]?.updatedAt
}

export function listDocuments(kind?: DocumentKind): EditorDocumentJSON[] {
  return listEntries(kind).map(entry => entry.json)
}

export interface DocumentEntry {
  json: EditorDocumentJSON
  updatedAt: number
}

export function listEntries(kind?: DocumentKind): DocumentEntry[] {
  return Object.values(readAll())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(entry => (kind ? entry.json.kind === kind : true))
}

export function deleteDocument(id: string): void {
  const map = readAll()
  delete map[id]
  writeAll(map)
}
