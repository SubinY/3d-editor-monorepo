import { describe, expect, it } from 'vitest'
import { composePreviewTransform } from '../node-preview'
import type { TransformJSON } from '../../document/types'

const base: TransformJSON = {
  position: [1, 2, 3],
  rotation: [0.1, 0.2, 0.3],
  scale: [1, 1, 1]
}

describe('composePreviewTransform', () => {
  it('缺省字段沿用 document transform', () => {
    expect(composePreviewTransform(base, {})).toEqual(base)
  })

  it('只改 position / rotation', () => {
    const next = composePreviewTransform(base, {
      position: [4, 5, 6],
      rotation: [0, 1, 0]
    })
    expect(next.position).toEqual([4, 5, 6])
    expect(next.rotation).toEqual([0, 1, 0])
    expect(next.scale).toEqual([1, 1, 1])
  })

  it('uniformScale 乘在 document.scale 上', () => {
    const next = composePreviewTransform(
      { ...base, scale: [2, 2, 2] },
      { uniformScale: 1.5 }
    )
    expect(next.scale).toEqual([3, 3, 3])
    expect(next.position).toEqual(base.position)
  })
})
