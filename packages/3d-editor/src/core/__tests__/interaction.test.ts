import { describe, expect, it, vi } from 'vitest'
import { createEditor } from '../create-editor'
import { GRID_SNAP_RULE_ID } from '../interaction'
import type { CatalogItem } from '../../catalog/types'

const cabinetItem: CatalogItem = {
  id: 'cabinet-a',
  version: '1.0.0',
  name: '标准电柜A',
  kind: 'equipment',
  placeableIn: ['scene'],
  footprint: { width: 0.8, depth: 0.6, height: 2 },
  model3d: { type: 'primitive', primitive: 'box', size: [0.8, 2, 0.6], color: '#3f7fbf' }
}

describe('EditorSession 交互配置', () => {
  it('默认 snap on、collision on、仅 translate；不注册硬网格约束', async () => {
    const session = await createEditor({
      document: { kind: 'scene', name: '室', bounds: { width: 20, depth: 15 } }
    })
    const state = session.getInteraction()
    expect(state.snapEnabled).toBe(true)
    expect(state.collisionEnabled).toBe(true)
    expect(state.collisionPreference).toBe(true)
    expect(state.transformModes).toEqual(['translate'])
    expect(state.transformMode).toBe('translate')
    expect(session.document.constraints.listRules().some(r => r.id === GRID_SNAP_RULE_ID)).toBe(false)

    const { node } = session.document.commands.placeItem(cabinetItem, { position: [1.26, 0, 2.74] })
    expect(node!.transform.position[0]).toBeCloseTo(1.26)
    expect(node!.transform.position[2]).toBeCloseTo(2.74)
    session.dispose()
  })

  it('setSnapEnabled 可开关且不影响落点连续坐标', async () => {
    const session = await createEditor({
      document: { kind: 'scene', name: '室', bounds: { width: 20, depth: 15 } }
    })
    session.setSnapEnabled(false)
    expect(session.getInteraction().snapEnabled).toBe(false)

    const { node } = session.document.commands.placeItem(cabinetItem, { position: [1.26, 0, 2.74] })
    expect(node!.transform.position[0]).toBeCloseTo(1.26)
    expect(node!.transform.position[2]).toBeCloseTo(2.74)
    session.dispose()
  })

  it('白名单含 scale 时强制关碰撞；去掉 scale 后恢复 preference', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const session = await createEditor({
      document: { kind: 'scene', name: '室', bounds: { width: 20, depth: 15 } },
      interaction: {
        collisionEnabled: true,
        transformModes: ['translate', 'scale']
      }
    })
    expect(warn).toHaveBeenCalled()
    expect(session.getInteraction().collisionEnabled).toBe(false)
    expect(session.getInteraction().collisionPreference).toBe(true)
    expect(session.document.collisionEnabled).toBe(false)

    session.setTransformModes(['translate', 'rotate'])
    expect(session.getInteraction().collisionEnabled).toBe(true)
    expect(session.document.collisionEnabled).toBe(true)
    warn.mockRestore()
    session.dispose()
  })

  it('setCollisionEnabled(true) 会踢掉 scale 并回退 mode', async () => {
    const session = await createEditor({
      document: { kind: 'scene', name: '室', bounds: { width: 20, depth: 15 } },
      interaction: {
        collisionEnabled: false,
        transformModes: ['translate', 'scale']
      }
    })
    session.setTransformMode('scale')
    expect(session.getInteraction().transformMode).toBe('scale')

    session.setCollisionEnabled(true)
    const state = session.getInteraction()
    expect(state.transformModes).toEqual(['translate'])
    expect(state.transformMode).toBe('translate')
    expect(state.collisionEnabled).toBe(true)
    session.dispose()
  })

  it('setTransformMode 不在白名单时 no-op', async () => {
    const session = await createEditor({
      document: { kind: 'scene', name: '室', bounds: { width: 20, depth: 15 } }
    })
    session.setTransformMode('scale')
    expect(session.getInteraction().transformMode).toBe('translate')
    session.dispose()
  })
})
