import type { ProceduralModelResolver } from '@mh/3d-editor'
import { createBreakerModel } from './create-breaker-model'

type Factory = (
  THREE: typeof import('three'),
  options: { footprint: { width: number; depth: number; height?: number } }
) => import('three').Object3D

const factories = new Map<string, Factory>([['comp-breaker', createBreakerModel]])

/** Host 注入 createEditor({ procedural: { resolve } }) */
export function createProceduralResolver(): ProceduralModelResolver {
  return (ref, ctx) => {
    const factory = factories.get(ref.id)
    if (!factory) return undefined
    return factory(ctx.THREE, { footprint: ctx.item.footprint })
  }
}
