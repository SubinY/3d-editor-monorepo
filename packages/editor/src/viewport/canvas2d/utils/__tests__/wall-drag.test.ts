import { describe, expect, it } from 'vitest'
import type { WallJSON } from '../../../document/types'
import { applyWallDrag } from '../wall-snap'

function wall(id: string, a: [number, number], b: [number, number]): WallJSON {
  return { id, a, b }
}

describe('applyWallDrag', () => {
  it('body 平移带动共享端点', () => {
    const walls = [
      wall('bottom', [0, 0], [4, 0]),
      wall('right', [4, 0], [4, 3]),
      wall('top', [4, 3], [0, 3]),
      wall('left', [0, 3], [0, 0])
    ]
    const patches = applyWallDrag(walls, 'bottom', 'body', 0, 1)
    const byId = Object.fromEntries(patches.map(p => [p.id, p]))
    expect(byId.bottom).toEqual({ id: 'bottom', a: [0, 1], b: [4, 1] })
    expect(byId.right.a).toEqual([4, 1])
    expect(byId.left.b).toEqual([0, 1])
    expect(byId.top).toBeUndefined()
  })

  it('拖端点 a 只动该簇', () => {
    const walls = [
      wall('bottom', [0, 0], [4, 0]),
      wall('right', [4, 0], [4, 3])
    ]
    const patches = applyWallDrag(walls, 'bottom', 'b', 1, 0)
    const byId = Object.fromEntries(patches.map(p => [p.id, p]))
    expect(byId.bottom).toEqual({ id: 'bottom', a: [0, 0], b: [5, 0] })
    expect(byId.right).toEqual({ id: 'right', a: [5, 0], b: [4, 3] })
  })
})
