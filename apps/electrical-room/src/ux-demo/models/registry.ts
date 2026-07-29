import type { ProceduralModelResolver } from '@3d-editor/editor'
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

export function createUxDemoProceduralResolver(): ProceduralModelResolver {
  return (ref, ctx) => {
    const factory = factories.get(ref.id)
    if (!factory) return undefined
    return factory(ctx.THREE, { footprint: ctx.item.footprint })
  }
}
