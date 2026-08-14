import type { CatalogItem, ProceduralModelResolver } from '@mh/3d-editor'
import { createDefaultContent, isContent } from './content'
import { createModel } from './model'
import { PROCEDURAL_ID } from './types'

/** Catalog 条目：贴地场景光圈 */
export function catalogItem(): CatalogItem {
  const glowRing = createDefaultContent()
  const diameter = glowRing.radius * 2
  return {
    id: 'fx-glow-ring',
    version: '1.0.0',
    name: '场景光圈',
    kind: 'glow-ring',
    category: 'effect',
    placeableIn: ['scene'],
    footprint: { width: diameter, depth: diameter, height: 0.02 },
    thumb: '#38BDF8',
    model3d: { type: 'procedural', id: PROCEDURAL_ID },
    metadata: { glowRing, defaults: { glowRing } }
  }
}

/** 注入 createEditor({ procedural: { resolvers } })；不匹配时返回 null */
export const resolve: ProceduralModelResolver = async (ref, ctx) => {
  if (ref.id !== PROCEDURAL_ID) return null
  const fallback = isContent(ctx.item.metadata?.glowRing)
    ? ctx.item.metadata.glowRing
    : createDefaultContent()
  const fromProps = isContent(ctx.node?.props?.glowRing)
    ? ctx.node!.props!.glowRing
    : fallback
  return createModel(ctx.THREE, fromProps).root
}
