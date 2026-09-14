/** 选中 AABB 四角手柄：屏幕左上旋转 / 右上面外 / 左下平面纵向 / 右下等比缩放 */
import { describe, expect, it } from 'vitest'
import {
  computeSelectionHandles,
  hitTestSelectionHandle,
  screenUpDeltaV,
  uniformFootprintFromRatio
} from '../selection-handles'

describe('computeSelectionHandles 屏幕四角', () => {
  it('俯视：屏幕上方为更小 v，左上=旋转 右上=面外 左下=纵向 右下=缩放', () => {
    const h = computeSelectionHandles({
      isElevation: false,
      center: { u: 0, v: 0 },
      eu: 1,
      ev: 1,
      pad: 0.1
    })
    expect(h.rotate).toEqual({ u: -1.1, v: -1.1 })
    expect(h.lift).toEqual({ u: 1.1, v: -1.1 })
    expect(h.slideV).toEqual({ u: -1.1, v: 1.1 })
    expect(h.scale).toEqual({ u: 1.1, v: 1.1 })
  })

  it('立面：屏幕上方为更大 v', () => {
    const h = computeSelectionHandles({
      isElevation: true,
      center: { u: 0, v: 0 },
      eu: 1,
      ev: 1,
      pad: 0.1
    })
    expect(h.rotate).toEqual({ u: -1.1, v: 1.1 })
    expect(h.lift).toEqual({ u: 1.1, v: 1.1 })
    expect(h.slideV).toEqual({ u: -1.1, v: -1.1 })
    expect(h.scale).toEqual({ u: 1.1, v: -1.1 })
  })
})

describe('hitTestSelectionHandle', () => {
  const handles = computeSelectionHandles({
    isElevation: false,
    center: { u: 0, v: 0 },
    eu: 1,
    ev: 1,
    pad: 0
  })

  it('命中右下缩放角', () => {
    expect(hitTestSelectionHandle(handles, 1, 1, 40)).toBe('scale')
  })

  it('中心不命中手柄', () => {
    expect(hitTestSelectionHandle(handles, 0, 0, 40)).toBeNull()
  })
})

describe('screenUpDeltaV / uniformFootprintFromRatio', () => {
  it('俯视：平面 v 减小 = 屏幕向上', () => {
    expect(screenUpDeltaV(false, -0.2)).toBeCloseTo(0.2)
    expect(screenUpDeltaV(true, 0.2)).toBeCloseTo(0.2)
  })

  it('按单轴比例三轴同乘', () => {
    const next = uniformFootprintFromRatio(
      { width: 1, depth: 2, height: 0.5 },
      2
    )
    expect(next.width).toBeCloseTo(2)
    expect(next.depth).toBeCloseTo(4)
    expect(next.height).toBeCloseTo(1)
  })
})
