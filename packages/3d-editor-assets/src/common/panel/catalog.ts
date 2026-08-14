import type { CatalogItem, ProceduralModelResolver } from '@mh/3d-editor'
import { createDefaultContent, isContent } from './content'
import { createModel } from './model'
import { PROCEDURAL_ID } from './types'

/** Catalog 条目 */
export function catalogItem(): CatalogItem {
  const panel = createDefaultContent()
  return {
    id: 'ui-info-panel',
    version: '1.0.0',
    name: '信息面板',
    kind: 'panel',
    category: 'fixture',
    placeableIn: ['scene'],
    footprint: { width: 1.6, depth: 0.05, height: 0.8 },
    thumb: '#38BDF8',
    model3d: { type: 'procedural', id: PROCEDURAL_ID },
    metadata: { panel, defaults: { panel } }
  }
}

/** 注入 createEditor({ procedural: { resolvers } })；不匹配时返回 null */
export const resolve: ProceduralModelResolver = async (ref, ctx) => {
  if (ref.id !== PROCEDURAL_ID) return null
  const fallback = isContent(ctx.item.metadata?.panel)
    ? ctx.item.metadata.panel
    : createDefaultContent()
  const fromProps = isContent(ctx.node?.props?.panel) ? ctx.node!.props!.panel : fallback
  const handle = await createModel(ctx.THREE, fromProps)
  return handle.root
}
