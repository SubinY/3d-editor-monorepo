import { describe, expect, it } from 'vitest'
import type { WallJSON } from '../../../document/types'
import { findClosedWallLoops } from '../closed-loops'

function wall(id: string, a: [number, number], b: [number, number]): WallJSON {
  return { id, a, b }
}

describe('findClosedWallLoops', () => {
  it('识别矩形四墙封闭环', () => {
    const walls = [
      wall('1', [-4, -3], [4, -3]),
      wall('2', [4, -3], [4, 3]),
      wall('3', [4, 3], [-4, 3]),
      wall('4', [-4, 3], [-4, -3])
    ]
    const loops = findClosedWallLoops(walls)
    expect(loops).toHaveLength(1)
    expect(loops[0].area).toBeCloseTo(48, 0)
    expect(loops[0].points.length).toBe(4)
  })

  it('多个互不连通的封闭房间都保留', () => {
    const walls = [
      // 大房间 8×6
      wall('a1', [0, 0], [8, 0]),
      wall('a2', [8, 0], [8, 6]),
      wall('a3', [8, 6], [0, 6]),
      wall('a4', [0, 6], [0, 0]),
      // 远处小房间 2×2
      wall('b1', [20, 0], [22, 0]),
      wall('b2', [22, 0], [22, 2]),
      wall('b3', [22, 2], [20, 2]),
      wall('b4', [20, 2], [20, 0])
    ]
    const loops = findClosedWallLoops(walls)
    expect(loops).toHaveLength(2)
    const areas = loops.map(l => l.area).sort((a, b) => a - b)
    expect(areas[0]).toBeCloseTo(4, 0)
    expect(areas[1]).toBeCloseTo(48, 0)
  })

  it('开口墙不产生环', () => {
    const walls = [
      wall('1', [0, 0], [4, 0]),
      wall('2', [4, 0], [4, 3]),
      wall('3', [4, 3], [0, 3])
    ]
    expect(findClosedWallLoops(walls)).toHaveLength(0)
  })
})
