import { describe, expect, it } from 'vitest'
import { createIndoorDefaultView } from '../../viewport/three/utils/indoor-view'
import { createDefaultEnvironment, createDefaultFloor } from '../defaults'
import { SCHEMA_VERSION } from '../types'
import { createEmptyDocumentJSON } from '../serialize'
import { EditorDocument } from '../EditorDocument'
import { resolveWallAppearance } from '../resolve-wall-appearance'

describe('createDefaultEnvironment', () => {
  it('scene：无场景级 floor/ceiling，有墙默认', () => {
    const env = createDefaultEnvironment('scene', { width: 20, depth: 15, height: 3 })
    expect(env.background).toEqual({ type: 'color', value: '#0c1420' })
    expect(env.helpers.enclosure).toBe('none')
    expect(env.shadows.enabled).toBe(true)
    expect(env.lights.some(l => l.type === 'ambient')).toBe(true)
    expect(env.lights.some(l => l.type === 'directional')).toBe(true)
    expect(env.defaultView?.position).toBeDefined()
    expect(env.defaultView?.type).toBe('orbit')
    expect((env as { floor?: unknown }).floor).toBeUndefined()
    expect((env as { ceiling?: unknown }).ceiling).toBeUndefined()
    expect(env.wall.color).toBe('#233242')
    expect(env.wall.presetId).toBe('none')
    expect(env.wall.cornerOverlap).toBe(false)
    expect(env.wall.defaultHeight).toBe(2)
  })

  it('container：openBox、无场景级 floor/ceiling', () => {
    const env = createDefaultEnvironment('container', { width: 0.8, depth: 0.6, height: 2 })
    expect(env.helpers.enclosure).toBe('openBox')
    expect(env.defaultView?.type).toBe('orbit')
    expect((env as { floor?: unknown }).floor).toBeUndefined()
  })
})

describe('createEmptyDocumentJSON', () => {
  it('写出 environment.wall；无 floor/ceiling；schema 1.0.0', () => {
    const json = createEmptyDocumentJSON({
      kind: 'scene',
      bounds: { width: 10, depth: 8, height: 3 }
    })
    expect(json.schemaVersion).toBe(SCHEMA_VERSION)
    expect(json.schemaVersion).toBe('1.0.0')
    expect(json.environment.wall.color).toBe('#233242')
    expect((json.environment as { floor?: unknown }).floor).toBeUndefined()
    expect(json.structure?.workspaces).toBeUndefined()
    expect(json.nodes).toEqual([])
  })
})

describe('resolveWallAppearance', () => {
  it('局部覆盖优先于全局', () => {
    const resolved = resolveWallAppearance(
      {
        id: 'w1',
        a: [0, 0],
        b: [1, 0],
        color: '#ff0000',
        height: 4
      },
      {
        color: '#233242',
        defaultHeight: 2,
        defaultThickness: 0.2
      },
      { width: 10, depth: 5, height: 3 }
    )
    expect(resolved.color).toBe('#ff0000')
    expect(resolved.height).toBe(4)
    expect(resolved.thickness).toBe(0.2)
  })
})

describe('workspaces', () => {
  it('addWorkspace / update / remove 进历史', () => {
    const doc = new EditorDocument({
      kind: 'scene',
      bounds: { width: 20, depth: 15, height: 3 }
    })
    const ws = doc.commands.addWorkspace(
      [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3]
      ],
      { name: 'A' }
    )
    expect(ws).toBeDefined()
    expect(doc.getWorkspaces()).toHaveLength(1)
    expect(ws!.floor.visible).toBe(true)
    doc.commands.updateWorkspace(ws!.id, {
      floor: { ...createDefaultFloor(), color: '#112233' }
    })
    expect(doc.getWorkspace(ws!.id)?.floor.color).toBe('#112233')
    doc.history.undo()
    expect(doc.getWorkspace(ws!.id)?.floor.color).toBe('#1a3048')
    doc.commands.removeWorkspace(ws!.id)
    expect(doc.getWorkspaces()).toHaveLength(0)
    doc.history.undo()
    expect(doc.getWorkspaces()).toHaveLength(1)
  })

  it('container 不支持 workspace', () => {
    const doc = new EditorDocument({
      kind: 'container',
      bounds: { width: 0.8, depth: 0.6, height: 2 }
    })
    expect(
      doc.commands.addWorkspace([
        [0, 0],
        [1, 0],
        [1, 1]
      ])
    ).toBeUndefined()
  })
})

describe('createIndoorDefaultView', () => {
  it('位姿落在房间内且 maxDistance 有限', () => {
    const view = createIndoorDefaultView({ width: 10, depth: 5, height: 2.5 })
    expect(view.type).toBe('orbit')
    expect(view.position[1]).toBeGreaterThan(0)
    expect(view.position[1]).toBeLessThan(2.5)
    expect(Math.abs(view.position[2])).toBeLessThan(5 / 2)
    expect(view.maxDistance).toBeGreaterThan(view.minDistance!)
    expect(view.fov).toBe(60)
  })
})
