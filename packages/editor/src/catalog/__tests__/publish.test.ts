import { describe, expect, it } from 'vitest'
import { createMemoryCatalog } from '../MemoryCatalog'
import { buildAssetPack, createPackCatalog, buildPublishBundle } from '../publish'
import type { CatalogItem } from '../types'
import type { EditorDocumentJSON } from '../../document/types'
import { SCHEMA_VERSION, createDefaultEnvironment } from '../../document/types'

const relay: CatalogItem = {
  id: 'comp-relay',
  version: '1.0.0',
  name: '继电器',
  placeableIn: ['container'],
  footprint: { width: 0.06, depth: 0.07, height: 0.08 },
  model3d: { type: 'primitive', primitive: 'box', size: [0.06, 0.08, 0.07], color: '#c0392b' }
}

const relayV2: CatalogItem = {
  ...relay,
  version: '1.1.0',
  model3d: { type: 'primitive', primitive: 'box', size: [0.06, 0.08, 0.07], color: '#27ae60' }
}

function cabinetDoc(): EditorDocumentJSON {
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
        id: 'n1',
        name: '继电器',
        catalogRef: { id: 'comp-relay', version: '1.0.0' },
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

const cabinetItem: CatalogItem = {
  id: 'cabinet-cab-1',
  version: '1.0.0',
  name: '测试柜',
  kind: 'cabinet',
  category: 'equipment',
  placeableIn: ['scene'],
  footprint: { width: 0.8, depth: 0.6, height: 2 },
  document: cabinetDoc(),
  shell3d: {
    type: 'primitive',
    primitive: 'box',
    size: [0.8, 2, 0.6],
    color: '#31424f'
  }
}

function sceneDoc(): EditorDocumentJSON {
  const bounds = { width: 20, depth: 15, height: 3 }
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'scene',
    id: 'scene-1',
    name: '测试室',
    unit: 'm',
    bounds,
    nodes: [
      {
        id: 'cab-node',
        name: '测试柜',
        catalogRef: { id: 'cabinet-cab-1', version: '1.0.0' },
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      }
    ],
    environment: createDefaultEnvironment('scene', bounds)
  }
}

describe('buildAssetPack', () => {
  it('深拷贝引用条目，嵌套柜内元件一并收入', async () => {
    const catalog = createMemoryCatalog([relay, cabinetItem])
    const pack = await buildAssetPack(sceneDoc(), catalog)
    expect(Object.keys(pack).sort()).toEqual(['cabinet-cab-1@1.0.0', 'comp-relay@1.0.0'])
    expect(pack['comp-relay@1.0.0'].model3d).toEqual(relay.model3d)

    // 改活库不影响已打 pack
    const live = await catalog.get('comp-relay', '1.0.0')
    if (live?.model3d && live.model3d.type === 'primitive') {
      live.model3d.color = '#000000'
    }
    expect(
      pack['comp-relay@1.0.0'].model3d &&
        pack['comp-relay@1.0.0'].model3d.type === 'primitive' &&
        pack['comp-relay@1.0.0'].model3d.color
    ).toBe('#c0392b')
  })

  it('缺项抛错', async () => {
    const catalog = createMemoryCatalog([cabinetItem])
    await expect(buildAssetPack(sceneDoc(), catalog)).rejects.toThrow(/missing catalog item/)
  })
})

describe('PackCatalog', () => {
  it('仅从 pack 解析，不回落活库新版', async () => {
    const live = createMemoryCatalog([relay, relayV2, cabinetItem])
    const bundle = await buildPublishBundle(sceneDoc(), live)
    // 活库升版后覆盖同 id 最新
    live.add({ ...relay, version: '1.0.0', name: '被改坏' })

    const packCat = createPackCatalog(bundle.assetPack)
    const item = await packCat.get('comp-relay', '1.0.0')
    expect(item?.name).toBe('继电器')
    expect(await packCat.get('comp-relay', '1.1.0')).toBeUndefined()
  })
})
