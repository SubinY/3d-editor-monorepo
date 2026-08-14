import type { ProceduralModelRef, ProceduralModelResolver, ProceduralResolveContext } from './types'

/**
 * 按序调用 resolvers，返回第一个非空 Object3D。
 * 单个 resolver 抛错时跳过并继续（与「不认返回 null」对称）。
 */
export async function runProceduralResolvers(
  resolvers: readonly ProceduralModelResolver[] | undefined,
  ref: ProceduralModelRef,
  ctx: ProceduralResolveContext
): Promise<import('three').Object3D | null | undefined> {
  if (!resolvers?.length) return undefined
  for (const resolve of resolvers) {
    try {
      const built = await resolve(ref, ctx)
      if (built) return built
    } catch (error) {
      console.warn(`[procedural] resolver failed for "${ref.id}"`, error)
    }
  }
  return undefined
}
