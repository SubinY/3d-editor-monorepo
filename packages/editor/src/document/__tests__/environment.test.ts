import { describe, expect, it } from 'vitest'
import { createDefaultEnvironment, SCHEMA_VERSION } from '../types'
import { createEmptyDocumentJSON } from '../serialize'

describe('createDefaultEnvironment', () => {
  it('scene：网格开、无 enclosure', () => {
    const env = createDefaultEnvironment('scene', { width: 20, depth: 15, height: 3 })
    expect(env.background).toEqual({ type: 'color', value: '#0c1420' })
    expect(env.helpers.grid).toBe(true)
    expect(env.helpers.enclosure).toBe('none')
    expect(env.shadows.enabled).toBe(true)
    expect(env.lights.some(l => l.type === 'ambient')).toBe(true)
    expect(env.lights.some(l => l.type === 'directional')).toBe(true)
    expect(env.defaultView?.position).toBeDefined()
    expect(env.defaultView?.type).toBe('orbit')
  })

  it('container：无网格、openBoxDoor、默认旋转相机', () => {
    const env = createDefaultEnvironment('container', { width: 0.8, depth: 0.6, height: 2 })
    expect(env.helpers.grid).toBe(false)
    expect(env.helpers.enclosure).toBe('openBoxDoor')
    expect(env.defaultView?.type).toBe('orbit')
  })
})

describe('createEmptyDocumentJSON', () => {
  it('写出完整 environment', () => {
    const json = createEmptyDocumentJSON({
      kind: 'scene',
      bounds: { width: 10, depth: 8, height: 3 }
    })
    expect(json.schemaVersion).toBe(SCHEMA_VERSION)
    expect(json.environment.helpers.grid).toBe(true)
    expect(json.nodes).toEqual([])
  })
})
