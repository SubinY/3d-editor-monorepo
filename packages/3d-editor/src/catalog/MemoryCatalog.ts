import type { CatalogItem, CatalogProvider, CatalogQuery } from './types'
import { catalogKey } from './types'

/**
 * 内存 Catalog（当前阶段的默认实现）。
 * 后期接 CDN / HTTP 时由 Host 换 Provider 实现，编辑器 API 不变。
 */
export class MemoryCatalog implements CatalogProvider {
  private items = new Map<string, CatalogItem>()
  /** id → 最新 version（注册顺序的最后一个） */
  private latest = new Map<string, string>()

  constructor(items: CatalogItem[] = []) {
    items.forEach(item => this.add(item))
  }

  add(item: CatalogItem): void {
    this.items.set(catalogKey(item.id, item.version), item)
    this.latest.set(item.id, item.version)
  }

  remove(id: string, version?: string): void {
    if (version) {
      this.items.delete(catalogKey(id, version))
      if (this.latest.get(id) === version) this.latest.delete(id)
      return
    }
    Array.from(this.items.keys())
      .filter(key => key.startsWith(`${id}@`))
      .forEach(key => this.items.delete(key))
    this.latest.delete(id)
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

  /** 该 id 当前登记的最新 version；无则 undefined */
  getLatestVersion(id: string): string | undefined {
    return this.latest.get(id)
  }
}

export function createMemoryCatalog(items: CatalogItem[] = []): MemoryCatalog {
  return new MemoryCatalog(items)
}
