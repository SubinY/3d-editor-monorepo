/**
 * Bootstrap：document + 业务元数据 + 场景依赖的柜 layout（避免 Host N+1）。
 * CatalogItem 组装仍由 Host CatalogProvider.get 完成。
 */

import { getNamespacedDocument } from './store.js'

function asRecord(json: unknown): Record<string, unknown> | null {
  return json && typeof json === 'object' ? (json as Record<string, unknown>) : null
}

function boundsOf(json: Record<string, unknown>): {
  width: number
  depth: number
  height: number
} {
  const b = asRecord(json.bounds)
  return {
    width: Number(b?.width) > 0 ? Number(b?.width) : 0.8,
    depth: Number(b?.depth) > 0 ? Number(b?.depth) : 0.6,
    height: Number(b?.height) > 0 ? Number(b?.height) : 2
  }
}

interface DocNode {
  catalogRef?: { id?: string }
  children?: DocNode[]
}

function walkNodes(nodes: unknown, visit: (node: DocNode) => void): void {
  if (!Array.isArray(nodes)) return
  for (const raw of nodes) {
    const node = asRecord(raw) as DocNode | null
    if (!node) continue
    visit(node)
    if (node.children?.length) walkNodes(node.children, visit)
  }
}

/** 从 scene document 收集 cabinet-* 业务 id */
function collectCabinetIds(doc: Record<string, unknown>): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  walkNodes(doc.nodes, node => {
    const catalogId = node.catalogRef?.id
    if (!catalogId?.startsWith('cabinet-')) return
    const cabinetId = catalogId.slice('cabinet-'.length)
    if (!cabinetId || seen.has(cabinetId)) return
    seen.add(cabinetId)
    ids.push(cabinetId)
  })
  return ids
}

/** 并行拉取本 scene 引用到的柜 layout */
async function loadContainerLayouts(
  cabinetIds: string[]
): Promise<Record<string, Record<string, unknown> | null>> {
  const out: Record<string, Record<string, unknown> | null> = {}
  await Promise.all(
    cabinetIds.map(async cabinetId => {
      const rec = await getNamespacedDocument('container', cabinetId)
      const json = rec?.json
      out[cabinetId] = json && json.kind === 'container' ? json : null
    })
  )
  return out
}

export async function buildSceneBootstrap(roomId: string): Promise<{
  document: Record<string, unknown> | null
  room: { id: string; name: string; length?: number; width?: number; height?: number }
  containerLayouts: Record<string, Record<string, unknown> | null>
}> {
  const sceneRec = await getNamespacedDocument('scene', roomId)
  const document = sceneRec?.json ?? null

  if (!document) {
    return {
      document: null,
      room: {
        id: roomId,
        name: roomId,
        length: 20,
        width: 15,
        height: 3
      },
      containerLayouts: {}
    }
  }

  const bounds = boundsOf(document)
  const containerLayouts = await loadContainerLayouts(collectCabinetIds(document))

  return {
    document,
    room: {
      id: roomId,
      name: String(document.name ?? roomId),
      length: bounds.width,
      width: bounds.depth,
      height: bounds.height
    },
    containerLayouts
  }
}

export async function buildContainerBootstrap(cabinetId: string): Promise<{
  document: Record<string, unknown> | null
  cabinet: { id: string; name: string; length?: number; width?: number; height?: number }
}> {
  const cabRec = await getNamespacedDocument('container', cabinetId)
  const document = cabRec?.json ?? null

  if (!document) {
    return {
      document: null,
      cabinet: {
        id: cabinetId,
        name: cabinetId,
        length: 0.8,
        width: 0.6,
        height: 2
      }
    }
  }

  const bounds = boundsOf(document)
  return {
    document,
    cabinet: {
      id: cabinetId,
      name: String(document.name ?? cabinetId),
      length: bounds.width,
      width: bounds.depth,
      height: bounds.height
    }
  }
}
