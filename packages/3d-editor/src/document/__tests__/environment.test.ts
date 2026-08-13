import { describe, expect, it } from 'vitest'
import { createIndoorDefaultView } from '../../viewport/three/utils/indoor-view'
import { createDefaultEnvironment } from '../defaults'
import { SCHEMA_VERSION } from '../types'
import { createEmptyDocumentJSON } from '../serialize'
import { EditorDocument } from '../EditorDocument'

describe('createDefaultEnvironment', () => {
  it('scene：无网格、无 enclosure、地面默认 bounds、天花默认隐藏', () => {
    const env = createDefaultEnvironment('scene', { width: 20, depth: 15, height: 3 })
    expect(env.background).toEqual({ type: 'color', value: '#0c1420' })
    expect(env.helpers.grid).toBe(false)
    expect(env.helpers.enclosure).toBe('none')
    expect(env.shadows.enabled).toBe(true)
    expect(env.lights.some(l => l.type === 'ambient')).toBe(true)
    expect(env.lights.some(l => l.type === 'directional')).toBe(true)
    expect(env.defaultView?.position).toBeDefined()
    expect(env.defaultView?.type).toBe('orbit')
    expect(env.floor.visible).toBe(true)
    expect(env.floor.coverage).toBe('bounds')
    expect(env.floor.presetId).toBe('none')
    expect(env.ceiling.visible).toBe(false)
    expect(env.ceiling.coverage).toBe('bounds')
    expect(env.wall.color).toBe('#233242')
    expect(env.wall.presetId).toBe('none')
  })

  it('container：无网格、openBoxDoor、地面与天花默认隐藏', () => {
    const env = createDefaultEnvironment('container', { width: 0.8, depth: 0.6, height: 2 })
    expect(env.helpers.grid).toBe(false)
    expect(env.helpers.enclosure).toBe('openBoxDoor')
    expect(env.defaultView?.type).toBe('orbit')
    expect(env.floor.visible).toBe(false)
    expect(env.ceiling.visible).toBe(false)
  })
})

describe('createEmptyDocumentJSON', () => {
  it('写出完整 environment（含 floor / ceiling / wall）', () => {
    const json = createEmptyDocumentJSON({
      kind: 'scene',
      bounds: { width: 10, depth: 8, height: 3 }
    })
    expect(json.schemaVersion).toBe(SCHEMA_VERSION)
    expect(json.environment.helpers.grid).toBe(false)
    expect(json.environment.floor.coverage).toBe('bounds')
    expect(json.environment.ceiling.visible).toBe(false)
    expect(json.environment.wall.color).toBe('#233242')
    expect(json.nodes).toEqual([])
  })
})

describe('ceiling backfill', () => {
  it('旧 JSON 缺 ceiling 时 fromJSON 回填默认隐藏', () => {
    const bare = createEmptyDocumentJSON({
      kind: 'scene',
      bounds: { width: 10, depth: 5, height: 2 }
    })
    delete (bare.environment as { ceiling?: unknown }).ceiling
    const doc = EditorDocument.fromJSON(bare)
    expect(doc.environment.ceiling.visible).toBe(false)
    expect(doc.environment.ceiling.coverage).toBe('bounds')
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
