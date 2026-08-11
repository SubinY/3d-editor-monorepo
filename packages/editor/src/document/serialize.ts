import type { CatalogProvider } from '../catalog/types'
import { createId } from '../utils/id'
import { EditorDocument, type CreateDocumentOptions, type ValidationWarning } from './EditorDocument'
import { cloneEnvironment, createDefaultEnvironment } from './defaults'
import { SCHEMA_VERSION, type EditorDocumentJSON } from './types'

export interface LoadDocumentOptions {
  catalog?: CatalogProvider
}

/** 仅生成空合同草稿（无 viewport / 历史），供 Host 落库 */
export function createEmptyDocumentJSON(options: CreateDocumentOptions): EditorDocumentJSON {
  const bounds = { ...options.bounds }
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: options.kind,
    id: options.id ?? createId(options.kind),
    name: options.name ?? options.kind,
    unit: 'm',
    bounds,
    structure: options.walls?.length ? { walls: options.walls.map(wall => ({ ...wall })) } : undefined,
    nodes: [],
    environment: options.environment
      ? cloneEnvironment(options.environment)
      : createDefaultEnvironment(options.kind, bounds),
    metadata: options.metadata ? { ...options.metadata } : undefined
  }
}

export function createDocument(options: CreateDocumentOptions): EditorDocument {
  return new EditorDocument(options)
}

/** 加载存盘 JSON：绑定 Catalog、预取条目、产出校验警告（不阻塞） */
export async function loadDocument(
  json: EditorDocumentJSON,
  options?: LoadDocumentOptions
): Promise<{ document: EditorDocument; warnings: ValidationWarning[] }> {
  const doc = EditorDocument.fromJSON(json)
  if (options?.catalog) {
    doc.attachCatalog(options.catalog)
    await doc.resolveItems()
  }
  const warnings = doc.validate()
  return { document: doc, warnings }
}
