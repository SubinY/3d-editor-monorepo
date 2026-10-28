import { describe, expect, it } from 'vitest'
import { createDefaultTransform } from '../../../../document/defaults'
import type { EditorNodeJSON } from '../../../../document/types'
import { nodesInMarquee, rectFromPoints } from '../marquee'

function node(id: string, x: number, z: number): EditorNodeJSON {
  const transform = createDefaultTransform()
  transform.position = [x, 0, z]
  return { id, transform }
}

const itemFor = () => ({
  id: 'n',
  version: '1',
  name: 'n',
  placeableIn: ['scene' as const],
  footprint: { width: 2, depth: 2, height: 1 }
})

describe('nodesInMarquee', () => {
  const nodes = [node('a', 0, 0), node('b', 5, 0), node('c', 0, 6)]

  it('部分压到足迹也选中，框外不选', () => {
    const rect = rectFromPoints({ u: 0.5, v: -0.5 }, { u: 1.2, v: 0.5 })
    expect(nodesInMarquee({
      nodes,
      rect,
      isElevation: false,
      planeFromPosition: pos => ({ u: pos[0], v: pos[2] }),
      itemFor
    })).toEqual(['a'])
  })

  it('框住多个时按文档顺序返回', () => {
    const rect = rectFromPoints({ u: -2, v: -2 }, { u: 6, v: 2 })
    expect(nodesInMarquee({
      nodes,
      rect,
      isElevation: false,
      planeFromPosition: pos => ({ u: pos[0], v: pos[2] }),
      itemFor
    })).toEqual(['a', 'b'])
  })
})
