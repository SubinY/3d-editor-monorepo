import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createMemoryCatalog } from '../MemoryCatalog'
import { buildAssetPack } from '../publish'
import type { CatalogItem, ProceduralModelResolver } from '../types'
import { createDefaultEnvironment } from '../../document/defaults'
import { SCHEMA_VERSION, type EditorDocumentJSON } from '../../document/types'

const breaker: CatalogItem = {
  id: 'comp-breaker',
  version: '1.0.0',
  name: '断路器',
  placeableIn: ['container'],
  footprint: { width: 0.1, depth: 0.09, height: 0.14 },
  model3d: { type: 'procedural', id: 'comp-breaker' }
}

function containerWithBreaker(): EditorDocumentJSON {
  const bounds = { width: 0.8, depth: 0.6, height: 2 }
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'container',
    id: 'cab-1',
    name: '测试柜',
    unit: 'm',
    bounds,
    nodes: [
      {
        id: 'brk-1',
        name: '断路器',
        catalogRef: { id: 'comp-breaker', version: '1.0.0' },
        transform: {
          position: [0, 1, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      }
    ],
    environment: createDefaultEnvironment('container', bounds)
  }
}

describe('procedural model3d', () => {
  it('assetPack 深拷贝保留 procedural id（可 JSON 序列化）', async () => {
    const catalog = createMemoryCatalog([breaker])
    const pack = await buildAssetPack(containerWithBreaker(), catalog)
    const item = pack['comp-breaker@1.0.0']
    expect(item.model3d).toEqual({ type: 'procedural', id: 'comp-breaker' })
    expect(JSON.parse(JSON.stringify(item.model3d))).toEqual({
      type: 'procedural',
      id: 'comp-breaker'
    })
  })

  it('Host resolver 契约：按 id 返回 Group；未知 id 返回空', async () => {
    const resolve: ProceduralModelResolver = (ref, ctx) => {
      if (ref.id !== 'comp-breaker') return undefined
      const g = new ctx.THREE.Group()
      g.name = 'comp-breaker'
      return g
    }
    const hit = await resolve({ id: 'comp-breaker' }, { item: breaker, THREE })
    expect(hit).toBeInstanceOf(THREE.Group)
    expect(hit?.name).toBe('comp-breaker')

    const miss = await resolve({ id: 'unknown' }, { item: breaker, THREE })
    expect(miss).toBeUndefined()
  })

  it('resolver 抛错可被调用方捕获（视口应回退盒子）', async () => {
    const resolve: ProceduralModelResolver = () => {
      throw new Error('boom')
    }
    expect(() => resolve({ id: 'comp-breaker' }, { item: breaker, THREE })).toThrow('boom')
  })

  it('procedural 可带 url 字段且可 JSON 序列化', () => {
    const item: CatalogItem = {
      ...breaker,
      model3d: {
        type: 'procedural',
        id: 'comp-breaker',
        url: '/models/comp-breaker@1.0.0.mjs'
      }
    }
    expect(JSON.parse(JSON.stringify(item.model3d))).toEqual({
      type: 'procedural',
      id: 'comp-breaker',
      url: '/models/comp-breaker@1.0.0.mjs'
    })
  })
})
