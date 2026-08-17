import { describe, expect, it } from 'vitest'
import type { CatalogItem } from '../../../../catalog/types'
import type { EditorNodeJSON } from '../../../../document/types'
import { hitTestNode, hitTestNodes } from '../hit-test'

function node(
  id: string,
  x: number,
  z: number,
  yaw = 0
): EditorNodeJSON {
  return {
    id,
    name: id,
    catalogRef: { id, version: '1' },
    transform: {
      position: [x, 0, z],
      rotation: [0, yaw, 0],
      scale: [1, 1, 1],
    },
  }
}

const items: Record<string, CatalogItem> = {
  big: {
    id: 'big',
    version: '1',
    name: '柜',
    placeableIn: ['scene'],
    footprint: { width: 2, depth: 2, height: 2 },
  },
  ring: {
    id: 'ring',
    version: '1',
    name: '光圈',
    placeableIn: ['scene'],
    footprint: { width: 4, depth: 4, height: 0.02 },
  },
}

const optsBase = {
  isElevation: false,
  planeFromPosition: (pos: [number, number, number]) => ({ u: pos[0], v: pos[2] }),
  footprintSize: (item: CatalogItem | undefined) =>
    item ? { wu: item.footprint.width, wv: item.footprint.depth } : { wu: 1, wv: 1 },
  itemFor: (n: EditorNodeJSON) => items[n.catalogRef!.id],
}

describe('hitTestNodes 鼠标点测', () => {
  it('同一点落在两个 footprint 内 → 上到下完整列表（后置为上）', () => {
    const nodes = [node('big', 0, 0), node('ring', 0, 0)]
    const hits = hitTestNodes({ ...optsBase, nodes, u: 0, v: 0 })
    expect(hits.map(n => n.id)).toEqual(['ring', 'big'])
  })

  it('点只在光圈外圈、未进柜子 → 单命中光圈', () => {
    const nodes = [node('big', 0, 0), node('ring', 0, 0)]
    const hits = hitTestNodes({ ...optsBase, nodes, u: 1.6, v: 0 })
    expect(hits.map(n => n.id)).toEqual(['ring'])
  })

  it('hitTestNode 返回最上层', () => {
    const nodes = [node('big', 0, 0), node('ring', 0, 0)]
    expect(hitTestNode({ ...optsBase, nodes, u: 0, v: 0 })?.id).toBe('ring')
  })

  it('空点无命中', () => {
    const nodes = [node('big', 0, 0)]
    expect(hitTestNodes({ ...optsBase, nodes, u: 10, v: 10 })).toEqual([])
  })
})
