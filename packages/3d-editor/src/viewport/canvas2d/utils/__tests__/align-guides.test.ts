import { describe, expect, it } from 'vitest'
import { snapWithAlignGuides } from '../align-guides'
import type { WallJSON } from '../../../../document/types'

describe('snapWithAlignGuides 贴边', () => {
  it('物件边贴另一物件边，不吸到中心重叠', () => {
    // 目标在原点 footprint 1×1；移动件宽 0.8，中心靠近目标右侧
    const result = snapWithAlignGuides({
      moving: { u: 1.05, v: 0, wu: 0.8, wv: 0.8 },
      targets: [{ u: 0, v: 0, wu: 1, wv: 1 }],
      walls: [],
      threshold: 0.2
    })
    // 移动件左边贴目标右边 → 中心 = 0.5 + 0.4 = 0.9
    expect(result.u).toBeCloseTo(0.9)
    expect(result.guides.some(g => g.axis === 'u')).toBe(true)
  })

  it('竖墙按厚度贴外表面', () => {
    const wall: WallJSON = {
      id: 'w1',
      a: [2, -1],
      b: [2, 1],
      thickness: 0.2
    }
    // 移动件宽 1，中心在墙左侧附近，右边应对齐墙左表面 2-0.1=1.9 → 中心 1.4
    const result = snapWithAlignGuides({
      moving: { u: 1.35, v: 0, wu: 1, wv: 1 },
      targets: [],
      walls: [wall],
      threshold: 0.2
    })
    expect(result.u).toBeCloseTo(1.4)
  })
})
