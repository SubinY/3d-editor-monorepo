import type { CatalogItem, ProceduralModelResolver } from '@mh/3d-editor'
import { createDefaultContent, isContent } from './content'
import { createModel } from './model'
import { PROCEDURAL_ID } from './types'

/** Catalog 条目：电子围栏 */
export function catalogItem(): CatalogItem {
  const alertBox = createDefaultContent()
  return {
    id: 'fx-alert-box',
    version: '1.0.0',
    name: '电子围栏',
    kind: 'alert-box',
    category: 'effect',
    placeableIn: ['scene'],
    footprint: {
      width: alertBox.width,
      depth: alertBox.depth,
      height: alertBox.height
    },
    thumb: '#FF3B30',
    model3d: { type: 'procedural', id: PROCEDURAL_ID },
    metadata: { alertBox, defaults: { alertBox } }
  }
}

/** 注入 createEditor({ procedural: { resolvers } })；不匹配时返回 null */
export const resolve: ProceduralModelResolver = async (ref, ctx) => {
  if (ref.id !== PROCEDURAL_ID) return null
  const fallback = isContent(ctx.item.metadata?.alertBox)
    ? ctx.item.metadata.alertBox
    : createDefaultContent()
  const fromProps = isContent(ctx.node?.props?.alertBox)
    ? ctx.node!.props!.alertBox
    : fallback
  return createModel(ctx.THREE, fromProps).root
}
