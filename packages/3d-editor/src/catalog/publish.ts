import { catalogKey, isDocumentItem } from './types'
import type { CatalogItem, CatalogProvider, CatalogQuery } from './types'
import type { EditorDocumentJSON, EditorNodeJSON } from '../document/types'

/** 发布交付物：Document + 用到的 Catalog 内容快照（深拷贝，非活引用） */
export interface PublishBundle {
  document: EditorDocumentJSON
  /** key = `${id}@${version}` */
  assetPack: Record<string, CatalogItem>
  publishedAt?: number
  name?: string
}

/**
 * Document / CatalogItem 均为 JSON 合同；用 JSON 深拷贝避免 structuredClone
 * 无法处理 Vue Proxy / 运行时脏字段的问题。
 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function walkNodes(nodes: EditorNodeJSON[], visit: (node: EditorNodeJSON) => void): void {
  for (const node of nodes) visit(node)
}

/**
 * 收集 Document（及嵌套 document 型条目内部）全部 catalogRef，
 * 从活 Catalog 解析后深拷贝进 pack。缺项抛错。
 */
export async function buildAssetPack(
  doc: EditorDocumentJSON,
  catalog: CatalogProvider
): Promise<Record<string, CatalogItem>> {
  const pack: Record<string, CatalogItem> = {}

  async function addRef(id: string, version: string): Promise<void> {
    const key = catalogKey(id, version)
    if (pack[key]) return
    const item = await catalog.get(id, version)
    if (!item) {
      throw new Error(`missing catalog item ${key}`)
    }
    const cloned = cloneJson(item)
    pack[key] = cloned
    if (isDocumentItem(cloned) && cloned.document) {
      const nested: Array<{ id: string; version: string }> = []
      walkNodes(cloned.document.nodes, node => {
        if (node.catalogRef) nested.push(node.catalogRef)
      })
      for (const ref of nested) {
        await addRef(ref.id, ref.version)
      }
    }
  }

  const roots: Array<{ id: string; version: string }> = []
  walkNodes(doc.nodes, node => {
    if (node.catalogRef) roots.push(node.catalogRef)
  })
  for (const ref of roots) {
    await addRef(ref.id, ref.version)
  }
  return pack
}

export async function buildPublishBundle(
  doc: EditorDocumentJSON,
  catalog: CatalogProvider,
  options?: { publishedAt?: number; name?: string }
): Promise<PublishBundle> {
  const assetPack = await buildAssetPack(doc, catalog)
  return {
    document: cloneJson(doc),
    assetPack,
    publishedAt: options?.publishedAt ?? Date.now(),
    name: options?.name ?? doc.name
  }
}

/** 只读 Catalog：监控首页等发布交付用，不再回活库 */
export class PackCatalog implements CatalogProvider {
  private items = new Map<string, CatalogItem>()
  private latest = new Map<string, string>()

  constructor(assetPack: Record<string, CatalogItem>) {
    for (const item of Object.values(assetPack)) {
      const key = catalogKey(item.id, item.version)
      this.items.set(key, item)
      const prev = this.latest.get(item.id)
      if (!prev || compareSemverLoose(item.version, prev) > 0) {
        this.latest.set(item.id, item.version)
      }
    }
  }

  async list(query?: CatalogQuery): Promise<CatalogItem[]> {
    let result = Array.from(this.items.values())
    if (query?.placeableIn) {
      result = result.filter(item => item.placeableIn.includes(query.placeableIn!))
    }
    if (query?.kind) {
      result = result.filter(item => item.kind === query.kind)
    }
    if (query?.category) {
      result = result.filter(item => item.category === query.category)
    }
    if (query?.tag) {
      result = result.filter(item => item.tags?.includes(query.tag!))
    }
    if (query?.text) {
      const text = query.text.toLowerCase()
      result = result.filter(item => item.name.toLowerCase().includes(text))
    }
    return result
  }

  async get(id: string, version?: string): Promise<CatalogItem | undefined> {
    const v = version ?? this.latest.get(id)
    if (!v) return undefined
    return this.items.get(catalogKey(id, v))
  }
}

export function createPackCatalog(assetPack: Record<string, CatalogItem>): PackCatalog {
  return new PackCatalog(assetPack)
}

/** 简易 semver 比较：a>b → 1；相等 0；a<b → -1；非法当 0.0.0 */
function compareSemverLoose(a: string, b: string): number {
  const pa = parseParts(a)
  const pb = parseParts(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1
    if (pa[i] < pb[i]) return -1
  }
  return 0
}

function parseParts(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v)
  if (!m) return [0, 0, 0]
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}
