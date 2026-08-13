import { describe, expect, it } from 'vitest'
import { cameraPoseAlongAxis } from '../world-view-gizmo'

describe('cameraPoseAlongAxis', () => {
  const target: [number, number, number] = [1, 2, 3]
  const radius = 10

  it('+X 从正 X 看向 target，up 为 Y', () => {
    const pose = cameraPoseAlongAxis(target, radius, 'x', 1)
    expect(pose.position).toEqual([11, 2, 3])
    expect(pose.up).toEqual([0, 1, 0])
  })

  it('-X 从负 X 看向 target', () => {
    const pose = cameraPoseAlongAxis(target, radius, 'x', -1)
    expect(pose.position).toEqual([-9, 2, 3])
    expect(pose.up).toEqual([0, 1, 0])
  })

  it('+Y 顶视使用稳定 up', () => {
    const pose = cameraPoseAlongAxis(target, radius, 'y', 1)
    expect(pose.position).toEqual([1, 12, 3])
    expect(pose.up).toEqual([0, 0, -1])
  })

  it('-Y 底视', () => {
    const pose = cameraPoseAlongAxis(target, radius, 'y', -1)
    expect(pose.position).toEqual([1, -8, 3])
    expect(pose.up).toEqual([0, 0, 1])
  })

  it('+Z / -Z', () => {
    expect(cameraPoseAlongAxis(target, radius, 'z', 1).position).toEqual([1, 2, 13])
    expect(cameraPoseAlongAxis(target, radius, 'z', -1).position).toEqual([1, 2, -7])
  })

  it('radius 过小也会夹到正数', () => {
    const pose = cameraPoseAlongAxis([0, 0, 0], 0, 'x', 1)
    expect(pose.position[0]).toBeGreaterThan(0)
  })
})
