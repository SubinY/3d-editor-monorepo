import type { CatalogItem, FootprintSpec } from '../../../catalog/types'

export type ProceduralCreateFn = (
  THREE: typeof import('three'),
  options: { footprint: FootprintSpec; item?: CatalogItem }
) => import('three').Object3D

const moduleCache = new Map<string, Promise<ProceduralCreateFn>>()

function resolveCreate(mod: Record<string, unknown>): ProceduralCreateFn {
  const candidates = [mod.createModel, mod.default, (mod.default as { create?: unknown } | undefined)?.create]
  for (const c of candidates) {
    if (typeof c === 'function') return c as ProceduralCreateFn
  }
  throw new Error('procedural module must export createModel(THREE, options) or default.create')
}

/** 动态加载 ESM 工厂（external three）；同 url 缓存 */
export function loadProceduralCreate(url: string): Promise<ProceduralCreateFn> {
  const existing = moduleCache.get(url)
  if (existing) return existing
  const pending = import(/* @vite-ignore */ url).then(mod => resolveCreate(mod as Record<string, unknown>))
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
  if (url) moduleCache.delete(url)
  else moduleCache.clear()
}
