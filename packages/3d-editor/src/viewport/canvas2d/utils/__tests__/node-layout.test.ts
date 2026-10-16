import { describe, expect, it } from 'vitest'
import {
  computeNodeLayout,
  displayAngleToYaw,
  planeHandleAngle,
  yawToDisplayAngle,
} from '../node-layout'

describe('planeHandleAngle / yaw display mapping', () => {
  it('φ=0 points +v (handle top)', () => {
    expect(planeHandleAngle(0, 1)).toBeCloseTo(0)
  })

  it('moving right from +v increases φ (matches mouse-to-the-right)', () => {
    const start = planeHandleAngle(0, 1)
    const right = planeHandleAngle(0.2, 1)
    expect(right - start).toBeGreaterThan(0)
  })

  it('yaw 已是顺时针世界角，与显示角同号', () => {
    expect(yawToDisplayAngle(0.5, true)).toBeCloseTo(0.5)
    expect(yawToDisplayAngle(0.5, false)).toBeCloseTo(0.5)
    expect(displayAngleToYaw(0.5, true)).toBeCloseTo(0.5)
  })

  it('elevation: 右拖增加显示角，文档 yaw 同步增加（顺时针）', () => {
    const baseYaw = 0
    const start = planeHandleAngle(0, 1)
    const pointer = planeHandleAngle(0.3, 1)
    const nextDisplay =
      yawToDisplayAngle(baseYaw, true) + (pointer - start)
    const nextYaw = displayAngleToYaw(nextDisplay, true)
    expect(nextDisplay).toBeGreaterThan(0)
    expect(nextYaw).toBeGreaterThan(0)
    expect(yawToDisplayAngle(nextYaw, true)).toBeCloseTo(nextDisplay)
  })

  it('scene: round-trip display ↔ yaw stays consistent with handle', () => {
    const baseYaw = 0.4
    const layout = computeNodeLayout({
      isElevation: false,
      plane: { u: 0, v: 0 },
      yaw: baseYaw,
      wu: 1,
      wv: 1,
    })
    const start = planeHandleAngle(
      layout.handle.u - layout.center.u,
      layout.handle.v - layout.center.v,
    )
    const pointer = start + 0.25
    const nextDisplay =
      yawToDisplayAngle(baseYaw, false) + (pointer - start)
    const nextYaw = displayAngleToYaw(nextDisplay, false)
    expect(yawToDisplayAngle(nextYaw, false)).toBeCloseTo(nextDisplay)
  })
})
