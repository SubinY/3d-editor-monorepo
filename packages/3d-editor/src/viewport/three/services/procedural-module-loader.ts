import type { CatalogItem, FootprintSpec } from '../../../catalog/types'

export type ProceduralCreateFn = (
  THREE: typeof import('three'),
  options: { footprint: FootprintSpec; item?: CatalogItem }
) => import('three').Object3D

const moduleCache = new Map<string, Promise<ProceduralCreateFn>>()
/** blob: URL 需在缓存存活期内保留，revoke 会导致已加载模块二次解析失败 */
const blobUrlBySource = new Map<string, string>()

function resolveCreate(mod: Record<string, unknown>): ProceduralCreateFn {
  const candidates = [mod.createModel, mod.default, (mod.default as { create?: unknown } | undefined)?.create]
  for (const c of candidates) {
    if (typeof c === 'function') return c as ProceduralCreateFn
  }
  throw new Error('procedural module must export createModel(THREE, options) or default.create')
}

/**
 * 经 fetch → blob URL → import，避免 Vite 开发服把同域 `/xxx.mjs` 改写成 `?import`
 *（public / 代理静态 ESM 不在 Vite 模块图内，直接 import 常 500）。
 * 约定：工厂模块不依赖相对路径 import（THREE 由调用方注入）。
 */
async function importProceduralEsm(url: string): Promise<Record<string, unknown>> {
  const existingBlob = blobUrlBySource.get(url)
  if (existingBlob) {
    return (await import(/* @vite-ignore */ existingBlob)) as Record<string, unknown>
  }
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`procedural module fetch failed: ${res.status} ${url}`)
  }
  const source = await res.text()
  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  blobUrlBySource.set(url, blobUrl)
  try {
    return (await import(/* @vite-ignore */ blobUrl)) as Record<string, unknown>
  } catch (error) {
    URL.revokeObjectURL(blobUrl)
    blobUrlBySource.delete(url)
    throw error
  }
}

/** 动态加载 ESM 工厂（external three）；同 url 缓存 */
export function loadProceduralCreate(url: string): Promise<ProceduralCreateFn> {
  const existing = moduleCache.get(url)
  if (existing) return existing
  const pending = importProceduralEsm(url).then(mod => resolveCreate(mod))
  moduleCache.set(url, pending)
  pending.catch(() => {
    moduleCache.delete(url)
  })
  return pending
}

export async function instantiateProceduralModule(
  url: string,
  THREE: typeof import('three'),
  options: { footprint: FootprintSpec; item?: CatalogItem }
): Promise<import('three').Object3D> {
  const create = await loadProceduralCreate(url)
  return create(THREE, options)
}

export function clearProceduralModuleCache(url?: string): void {
  if (url) {
    moduleCache.delete(url)
    const blob = blobUrlBySource.get(url)
    if (blob) {
      URL.revokeObjectURL(blob)
      blobUrlBySource.delete(url)
    }
    return
  }
  moduleCache.clear()
  for (const blob of blobUrlBySource.values()) URL.revokeObjectURL(blob)
  blobUrlBySource.clear()
}
