import { describe, expect, it } from 'vitest'
import { planAlign, planDistribute, type AlignSubject } from '../align'
import { createDefaultTransform } from '../defaults'

function subject(id: string, x: number, z: number, width = 1, depth = 1): AlignSubject {
  const transform = createDefaultTransform()
  transform.position = [x, 0, z]
  return { id, transform, footprint: { width, depth, height: 1 } }
}

describe('planAlign / planDistribute', () => {
  it('参照框左对齐只改 u，参照 primary 时主选不动', () => {
    const nodes = [subject('a', 0, 0), subject('b', 4, 2)]
    const bounds = planAlign(nodes, 'left', 'bounds', 'xz')
    expect(bounds).toEqual([{ id: 'b', du: -4, dv: 0 }])
    const primary = planAlign(nodes, 'left', 'primary', 'xz')
    expect(primary).toEqual([{ id: 'b', du: -4, dv: 0 }])
    const stay = planAlign([subject('b', 4, 2), subject('a', 0, 0)], 'left', 'primary', 'xz')
    expect(stay.find(item => item.id === 'b')).toBeUndefined()
    expect(stay).toEqual([{ id: 'a', du: 4, dv: 0 }])
  })

  it('俯视顶对齐把各盒 minV 收到联合框顶边', () => {
    const nodes = [subject('a', 0, 0), subject('b', 3, 5)]
    expect(planAlign(nodes, 'top', 'bounds', 'xz')).toEqual([{ id: 'b', du: 0, dv: -5 }])
  })

  it('立面顶对齐对齐到较大的 v', () => {
    const low = subject('a', 0, 0)
    low.transform.position = [0, 0, 0]
    const high = subject('b', 0, 0)
    high.transform.position = [2, 4, 0]
    expect(planAlign([low, high], 'top', 'bounds', 'xy')).toEqual([{ id: 'a', du: 0, dv: 4 }])
  })

  it('水平分布保持两端，中间等空隙', () => {
    const nodes = [subject('a', 0, 0, 2, 1), subject('b', 3, 0, 2, 1), subject('c', 10, 0, 2, 1)]
    const deltas = planDistribute(nodes, 'x', 'xz')
    const byId = Object.fromEntries(deltas.map(item => [item.id, item.du]))
    expect(byId.a ?? 0).toBeCloseTo(0)
    expect(byId.c ?? 0).toBeCloseTo(0)
    expect(byId.b).toBeCloseTo(2)
  })
})
