import type { ProceduralModelResolver } from '@mh/3d-editor'
import { commonProceduralResolvers } from '@mh/3d-editor-assets/common'
import { createBreakerModel } from './create-breaker-model'

type Factory = (
  THREE: typeof import('three'),
  options: { footprint: { width: number; depth: number; height?: number } }
) => import('three').Object3D

const factories = new Map<string, Factory>([['comp-breaker', createBreakerModel]])

const hostFactoryResolver: ProceduralModelResolver = (ref, ctx) => {
  const factory = factories.get(ref.id)
  if (!factory) return undefined
  return factory(ctx.THREE, { footprint: ctx.item.footprint })
}

/** Host 注入 createEditor({ procedural: { resolvers } }) */
export function createProceduralResolvers(): ProceduralModelResolver[] {
  return [...commonProceduralResolvers, hostFactoryResolver]
}
