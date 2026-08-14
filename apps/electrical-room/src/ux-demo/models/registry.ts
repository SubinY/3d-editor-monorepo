import type { ProceduralModelResolver } from '@mh/3d-editor'
import { createCabinetModel } from './create-cabinet-model'
import { createDoorModel } from './create-door-model'

type Factory = (
  THREE: typeof import('three'),
  options: { footprint: { width: number; depth: number; height?: number } }
) => import('three').Object3D

const factories = new Map<string, Factory>([
  ['ux-cabinet', createCabinetModel],
  ['ux-cabinet-ups', createCabinetModel],
  ['ux-door', createDoorModel]
])

const hostFactoryResolver: ProceduralModelResolver = (ref, ctx) => {
  const factory = factories.get(ref.id)
  if (!factory) return undefined
  return factory(ctx.THREE, { footprint: ctx.item.footprint })
}

/** UX demo：注入 createEditor({ procedural: { resolvers } }) */
export function createUxDemoProceduralResolvers(): ProceduralModelResolver[] {
  return [hostFactoryResolver]
}
