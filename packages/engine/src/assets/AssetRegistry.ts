export interface AssetMeta {
  id: string
  name: string
  tags?: string[]
  url: string
  size?: number
}

export class AssetRegistry {
  private assets: Map<string, AssetMeta> = new Map()

  register(meta: AssetMeta): void {
    this.assets.set(meta.id, meta)
  }

  get(id: string): AssetMeta | undefined {
    return this.assets.get(id)
  }

  list(): AssetMeta[] {
    return Array.from(this.assets.values())
  }
}
