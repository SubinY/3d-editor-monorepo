import { describe, expect, it } from 'vitest'
import { createIndoorDefaultView } from '../indoor-view'
import { createTopDefaultView, resolveLookIntent, type LookContext } from '../look'

const bounds = { width: 20, depth: 12, height: 3 }

function ctx(partial?: Partial<LookContext>): LookContext {
  return {
    defaultView: {
      type: 'orbit',
      position: [7.5, 5.5, 8.5],
      target: [0, 0.9, 0],
      fov: 45
    },
    bounds,
    currentTarget: [1, 0.5, 2],
    currentRadius: 10,
    currentProjection: 'orbit',
    ...partial
  }
}

describe('resolveLookIntent', () => {
  it('home：用文档 defaultView，默认 applyPose', () => {
    const intent = resolveLookIntent({ at: 'home' }, ctx())
    expect(intent).toMatchObject({
      action: 'apply',
      applyPose: true,
      view: {
        type: 'orbit',
        position: [7.5, 5.5, 8.5],
        target: [0, 0.9, 0]
      }
    })
  })

  it('pose：写入显式位姿；projection 覆盖 type', () => {
    const view = createIndoorDefaultView(bounds)
    const intent = resolveLookIntent(
      { at: 'pose', view },
      ctx(),
      { projection: 'orthographic', applyPose: false }
    )
    expect(intent.action).toBe('apply')
    if (intent.action !== 'apply') return
    expect(intent.applyPose).toBe(false)
    expect(intent.view.type).toBe('orthographic')
    expect(intent.view.position).toEqual(view.position)
  })

  it('indoor：persist 默认 false；位姿落在房间内', () => {
    const intent = resolveLookIntent({ at: 'indoor' }, ctx())
    expect(intent.action).toBe('apply')
    if (intent.action !== 'apply') return
    expect(intent.persist).toBe(false)
    expect(intent.applyPose).toBe(true)
    expect(intent.view.type).toBe('orbit')
    expect(intent.view.position[1]).toBeGreaterThan(0)
    expect(Math.abs(intent.view.position[2])).toBeLessThan(bounds.depth / 2)
  })

  it('indoor persist: true 标记写回', () => {
    const intent = resolveLookIntent({ at: 'indoor', persist: true }, ctx())
    expect(intent.action).toBe('apply')
    if (intent.action !== 'apply') return
    expect(intent.persist).toBe(true)
  })

  it('top：默认 orthographic + 正上方 + scene 居中', () => {
    const intent = resolveLookIntent({ at: 'top' }, ctx())
    expect(intent.action).toBe('apply')
    if (intent.action !== 'apply') return
    expect(intent.view.type).toBe('orthographic')
    expect(intent.view.target).toEqual([0, 0, 0])
    expect(intent.view.position[0]).toBeCloseTo(0)
    expect(intent.view.position[2]).toBeCloseTo(0)
    expect(intent.view.position[1]).toBeGreaterThan(0)
    expect(intent.up).toEqual([0, 0, -1])
  })

  it('node / selection 聚焦；无选中则 noop', () => {
    const node = resolveLookIntent({ at: 'node', path: 'cab-1' }, ctx(), { padding: 2 })
    expect(node).toEqual({
      action: 'focus',
      path: 'cab-1',
      padding: 2,
      projection: undefined
    })
    expect(resolveLookIntent({ at: 'selection' }, ctx())).toEqual({ action: 'noop' })
    expect(resolveLookIntent({ at: 'selection' }, ctx({ selectedId: 'n1' }))).toMatchObject({
      action: 'focus',
      path: 'n1',
      padding: 1.4
    })
  })
})

describe('createTopDefaultView', () => {
  it('fit keep 保留当前 target', () => {
    const { view } = createTopDefaultView({
      bounds,
      fit: 'keep',
      currentTarget: [3, 1, -2],
      currentRadius: 8,
      projection: 'orthographic'
    })
    expect(view.target).toEqual([3, 1, -2])
    expect(view.position[1]).toBeGreaterThan(1)
  })
})
