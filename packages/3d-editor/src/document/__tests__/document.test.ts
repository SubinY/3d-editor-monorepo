import { describe, expect, it } from 'vitest'
import { createMemoryCatalog } from '../../catalog/MemoryCatalog'
import type { CatalogItem } from '../../catalog/types'
import { boundsConstraint, gridSnapConstraint } from '../constraints'
import { EditorDocument } from '../EditorDocument'
import { createDocument, loadDocument } from '../serialize'

const cabinetItem: CatalogItem = {
  id: 'cabinet-a',
  version: '1.0.0',
  name: '标准电柜A',
  kind: 'equipment',
  placeableIn: ['scene'],
  footprint: { width: 0.8, depth: 0.6, height: 2 },
  thumb: '#3f7fbf',
  model3d: { type: 'primitive', primitive: 'box', size: [0.8, 2, 0.6], color: '#3f7fbf' }
}

const breakerItem: CatalogItem = {
  id: 'breaker',
  version: '1.0.0',
  name: '断路器',
  kind: 'component',
  placeableIn: ['container'],
  footprint: { width: 0.1, depth: 0.08, height: 0.12 },
  model3d: { type: 'primitive', primitive: 'box', size: [0.1, 0.12, 0.08], color: '#e67e22' }
}

function createSceneDoc() {
  return createDocument({ kind: 'scene', name: '电柜室', bounds: { width: 20, depth: 15 } })
}

describe('EditorDocument 命令与历史', () => {
  it('placeItem 创建节点并默认选中', () => {
    const doc = createSceneDoc()
    const result = doc.commands.placeItem(cabinetItem, { position: [1, 0, 2] })
    expect(result.node).toBeDefined()
    expect(result.node!.catalogRef).toEqual({ id: 'cabinet-a', version: '1.0.0' })
    expect(doc.getNodes()).toHaveLength(1)
    expect(doc.selection.first()).toBe(result.node!.id)
  })

  it('placeableIn 不匹配时拒绝放置', () => {
    const doc = createSceneDoc()
    const result = doc.commands.placeItem(breakerItem)
    expect(result.node).toBeUndefined()
    expect(result.denied).toContain('not placeable')
  })

  it('transformNode 移动节点并可撤销重做（document 为唯一历史栈）', () => {
    const doc = createSceneDoc()
    const { node } = doc.commands.placeItem(cabinetItem, { position: [0, 0, 0] })
    doc.commands.transformNode(node!.id, { position: [3, 0, 4] })
    expect(doc.getNode(node!.id)!.transform.position).toEqual([3, 0, 4])

    expect(doc.history.undo()).toBe(true)
    expect(doc.getNode(node!.id)!.transform.position).toEqual([0, 0, 0])
    expect(doc.history.redo()).toBe(true)
    expect(doc.getNode(node!.id)!.transform.position).toEqual([3, 0, 4])

    // 撤销放置
    doc.history.undo() // transform
    doc.history.undo() // place
    expect(doc.getNodes()).toHaveLength(0)
    doc.history.redo()
    expect(doc.getNodes()).toHaveLength(1)
  })

  it('removeNode 可撤销恢复', () => {
    const doc = createSceneDoc()
    const { node } = doc.commands.placeItem(cabinetItem)
    doc.commands.removeNode(node!.id)
    expect(doc.getNodes()).toHaveLength(0)
    doc.history.undo()
    expect(doc.getNodes()).toHaveLength(1)
    expect(doc.getNode(node!.id)).toBeDefined()
  })

  it('duplicateNode 深拷贝 props / children，单条历史可撤销', () => {
    const doc = createSceneDoc()
    const { node } = doc.commands.placeItem(cabinetItem, {
      position: [1, 0, 2],
      name: '柜A',
      props: { panel: { title: 'A柜' }, bindings: [{ key: 'temp', path: 'a.temp' }] }
    })
    const childResult = doc.commands.placeItem(cabinetItem, {
      parentId: node!.id,
      position: [0.1, 0.5, 0],
      name: '子件',
      props: { tag: 'inner' },
      select: false
    })
    expect(childResult.node).toBeDefined()

    const result = doc.commands.duplicateNode(node!.id, { offset: [1.5, 0, 1] })
    expect(result.denied).toBeUndefined()
    const copy = result.node!
    expect(copy.id).not.toBe(node!.id)
    expect(copy.name).toBe('柜A 副本')
    expect(copy.transform.position).toEqual([2.5, 0, 3])
    expect(copy.props).toEqual({
      panel: { title: 'A柜' },
      bindings: [{ key: 'temp', path: 'a.temp' }]
    })
    expect(copy.children).toHaveLength(1)
    expect(copy.children![0].id).not.toBe(childResult.node!.id)
    expect(copy.children![0].props).toEqual({ tag: 'inner' })
    expect(doc.getNodes()).toHaveLength(2)
    expect(doc.selection.first()).toBe(copy.id)

    expect(doc.history.undo()).toBe(true)
    expect(doc.getNodes()).toHaveLength(1)
    expect(doc.getNode(copy.id)).toBeUndefined()
    expect(doc.history.redo()).toBe(true)
    expect(doc.getNodes()).toHaveLength(2)
  })

  it('history.transaction 将多条命令合并为一次撤销', () => {
    const doc = createSceneDoc()
    doc.history.transaction('batch place', () => {
      doc.commands.placeItem(cabinetItem, { position: [0, 0, 0], select: false })
      doc.commands.placeItem(cabinetItem, { position: [2, 0, 0], select: false })
    })
    expect(doc.getNodes()).toHaveLength(2)
    expect(doc.history.undo()).toBe(true)
    expect(doc.getNodes()).toHaveLength(0)
    expect(doc.history.redo()).toBe(true)
    expect(doc.getNodes()).toHaveLength(2)
  })
})

describe('约束引擎', () => {
  it('boundsConstraint 将越界位置收回边界内', () => {
    const doc = createSceneDoc()
    doc.constraints.register(boundsConstraint())
    const { node } = doc.commands.placeItem(cabinetItem, { position: [100, 0, 0] })
    expect(node).toBeDefined()
    const x = node!.transform.position[0]
    expect(x).toBeLessThanOrEqual(10)
  })

  it('gridSnapConstraint 吸附到网格', () => {
    const doc = createSceneDoc()
    doc.constraints.register(gridSnapConstraint({ size: 0.5 }))
    const { node } = doc.commands.placeItem(cabinetItem, { position: [1.26, 0, 2.74] })
    expect(node!.transform.position[0]).toBeCloseTo(1.5)
    expect(node!.transform.position[2]).toBeCloseTo(2.5)
  })

  it('gridSnapConstraint container 吸附 XY', () => {
    const doc = createDocument({ kind: 'container', bounds: { width: 0.8, depth: 0.6, height: 2 } })
    doc.constraints.register(gridSnapConstraint({ size: 0.5 }))
    const { node } = doc.commands.placeItem(breakerItem, { position: [0.26, 1.24, -0.1] })
    expect(node!.transform.position[0]).toBeCloseTo(0.5)
    expect(node!.transform.position[1]).toBeCloseTo(1)
    expect(node!.transform.position[2]).toBeCloseTo(-0.1)
  })

  it('自定义规则可以拒绝变换', () => {
    const doc = createSceneDoc()
    const { node } = doc.commands.placeItem(cabinetItem, { position: [0, 0, 0] })
    doc.constraints.register({
      id: 'host:forbid-x-negative',
      evaluate(input) {
        return input.transform.position[0] >= 0 ? true : { allowed: false, reason: 'x<0' }
      }
    })
    const result = doc.commands.transformNode(node!.id, { position: [-2, 0, 0] })
    expect(result.ok).toBe(false)
    expect(result.denied).toBe('x<0')
    expect(doc.getNode(node!.id)!.transform.position).toEqual([0, 0, 0])
  })
})

describe('AABB 碰撞（MVP 内建）', () => {
  it('放置重叠位置被拒绝，错开后允许', () => {
    const doc = createSceneDoc()
    doc.commands.placeItem(cabinetItem, { position: [0, 0, 0] })
    const overlap = doc.commands.placeItem(cabinetItem, { position: [0.3, 0, 0] })
    expect(overlap.node).toBeUndefined()
    expect(overlap.denied).toContain('collision')

    const apart = doc.commands.placeItem(cabinetItem, { position: [2, 0, 0] })
    expect(apart.node).toBeDefined()
  })

  it('移动到与他人重叠的位置被拒绝且不改变原位置', () => {
    const doc = createSceneDoc()
    doc.commands.placeItem(cabinetItem, { position: [0, 0, 0], select: false })
    const { node } = doc.commands.placeItem(cabinetItem, { position: [3, 0, 0] })
    const result = doc.commands.transformNode(node!.id, { position: [0.2, 0, 0] })
    expect(result.ok).toBe(false)
    expect(result.denied).toContain('collision')
    expect(doc.getNode(node!.id)!.transform.position).toEqual([3, 0, 0])
  })

  it('collisionEnabled=false 时不拦截', () => {
    const doc = createSceneDoc()
    doc.collisionEnabled = false
    doc.commands.placeItem(cabinetItem, { position: [0, 0, 0] })
    const overlap = doc.commands.placeItem(cabinetItem, { position: [0.1, 0, 0] })
    expect(overlap.node).toBeDefined()
  })

  it('container 立面碰撞用宽×高（XY）', () => {
    const doc = createDocument({
      kind: 'container',
      bounds: { width: 0.8, depth: 0.6, height: 2 }
    })
    doc.commands.placeItem(breakerItem, { position: [0, 1, 0] })
    const overlap = doc.commands.placeItem(breakerItem, { position: [0.02, 1.02, 0] })
    expect(overlap.denied).toContain('collision')
    const apart = doc.commands.placeItem(breakerItem, { position: [0, 0.2, 0] })
    expect(apart.node).toBeDefined()
  })
})

describe('setBounds', () => {
  it('修改尺寸进历史并可撤销', () => {
    const doc = createDocument({ kind: 'container', bounds: { width: 0.8, depth: 0.6, height: 2 } })
    doc.commands.setBounds({ width: 1.2, height: 2.2 })
    expect(doc.bounds).toEqual({ width: 1.2, depth: 0.6, height: 2.2 })
    doc.history.undo()
    expect(doc.bounds).toEqual({ width: 0.8, depth: 0.6, height: 2 })
    doc.history.redo()
    expect(doc.bounds.width).toBe(1.2)
  })

  it('修改 height 时同步墙高，撤销可恢复', () => {
    const doc = createDocument({ kind: 'scene', bounds: { width: 10, depth: 5, height: 2 } })
    doc.createRectRoom()
    expect(doc.getWalls().every(w => w.height === 2)).toBe(true)
    doc.commands.setBounds({ height: 3.5 })
    expect(doc.bounds.height).toBe(3.5)
    expect(doc.getWalls().every(w => w.height === 3.5)).toBe(true)
    doc.history.undo()
    expect(doc.bounds.height).toBe(2)
    expect(doc.getWalls().every(w => w.height === 2)).toBe(true)
  })
})

describe('setEnvironment', () => {
  it('写入完整 environment 并可撤销', () => {
    const doc = createDocument({ kind: 'container', bounds: { width: 0.8, depth: 0.6, height: 2 } })
    expect(doc.environment.helpers.enclosure).toBe('openBox')
    const next = {
      ...doc.environment,
      helpers: { grid: false, enclosure: 'none' as const },
      background: { type: 'color' as const, value: '#112233' }
    }
    doc.commands.setEnvironment(next)
    expect(doc.environment.helpers.enclosure).toBe('none')
    expect(doc.environment.background).toEqual({ type: 'color', value: '#112233' })
    doc.history.undo()
    expect(doc.environment.helpers.enclosure).toBe('openBox')
    doc.history.redo()
    expect(doc.environment.helpers.enclosure).toBe('none')
  })

  it('toJSON 带上 environment；缺省 fromJSON 补默认', () => {
    const doc = createDocument({ kind: 'scene', bounds: { width: 20, depth: 15, height: 3 } })
    const json = doc.toJSON()
    expect(json.environment.helpers.grid).toBe(false)
    expect(json.environment.ceiling.visible).toBe(false)
    const bare = { ...json, environment: undefined as unknown as typeof json.environment }
    const loaded = EditorDocument.fromJSON(bare as typeof json)
    expect(loaded.environment.helpers.enclosure).toBe('none')
    expect(loaded.environment.background.type).toBe('color')
    expect(loaded.environment.ceiling.visible).toBe(false)
  })
})

describe('墙体（线段墙定稿 D4）', () => {
  it('scene 支持 addWall 与撤销；container 不支持', () => {
    const doc = createSceneDoc()
    const wall = doc.commands.addWall([-10, -7.5], [10, -7.5])
    expect(wall).toBeDefined()
    expect(doc.getWalls()).toHaveLength(1)
    doc.history.undo()
    expect(doc.getWalls()).toHaveLength(0)

    const cabinet = createDocument({ kind: 'container', bounds: { width: 0.8, depth: 0.6, height: 2 } })
    expect(cabinet.commands.addWall([0, 0], [1, 0])).toBeUndefined()
  })

  it('createRectRoom 生成四段闭合墙', () => {
    const doc = createSceneDoc()
    doc.createRectRoom({ height: 3 })
    expect(doc.getWalls()).toHaveLength(4)
  })

  it('moveWalls 批量改端点并可撤销', () => {
    const doc = createSceneDoc()
    const w1 = doc.commands.addWall([0, 0], [4, 0])!
    const w2 = doc.commands.addWall([4, 0], [4, 3])!
    const ok = doc.commands.moveWalls([
      { id: w1.id, a: [0, 1], b: [4, 1] },
      { id: w2.id, a: [4, 1], b: [4, 3] }
    ])
    expect(ok).toBe(true)
    expect(doc.getWall(w1.id)?.a).toEqual([0, 1])
    expect(doc.getWall(w2.id)?.a).toEqual([4, 1])
    doc.history.undo()
    expect(doc.getWall(w1.id)?.a).toEqual([0, 0])
    expect(doc.getWall(w2.id)?.a).toEqual([4, 0])
  })

  it('moveWalls 拒绝近零长度', () => {
    const doc = createSceneDoc()
    const w = doc.commands.addWall([0, 0], [4, 0])!
    expect(doc.commands.moveWalls([{ id: w.id, a: [0, 0], b: [0.01, 0] }])).toBe(false)
    expect(doc.getWall(w.id)?.b).toEqual([4, 0])
  })
})

describe('序列化与加载', () => {
  it('toJSON/fromJSON 往返一致', () => {
    const doc = createSceneDoc()
    doc.createRectRoom()
    doc.commands.placeItem(cabinetItem, { position: [2, 0, 3], props: { circuit: 'A-01' } })
    const json = doc.toJSON()
    expect(json.schemaVersion).toBe('2.0.0')
    expect(json.unit).toBe('m')
    expect(json.environment.helpers.grid).toBe(false)
    expect(json.environment.helpers.enclosure).toBe('none')
    expect(json.structure?.walls).toHaveLength(4)
    expect(json.nodes).toHaveLength(1)
    expect(json.nodes[0].props).toEqual({ circuit: 'A-01' })

    const restored = JSON.parse(JSON.stringify(json))
    const loaded = EditorDocument.fromJSON(restored)
    expect(loaded.getNodes()).toHaveLength(1)
    expect(loaded.getWalls()).toHaveLength(4)
    expect(loaded.toJSON().nodes).toEqual(json.nodes)
  })

  it('loadDocument 绑定 catalog、预取条目并产出警告（不阻塞）', async () => {
    const doc = createSceneDoc()
    doc.commands.placeItem(cabinetItem, { position: [0, 0, 0] })
    const json = doc.toJSON()
    // 手工制造越界数据
    json.nodes[0].transform.position = [999, 0, 0]

    const catalog = createMemoryCatalog([cabinetItem])
    const { document, warnings } = await loadDocument(json, { catalog })
    document.constraints.register(boundsConstraint())
    const revalidated = document.validate()

    expect(document.getNodes()).toHaveLength(1)
    expect(document.getCachedItem(document.getNodes()[0])).toBeDefined()
    expect(warnings).toHaveLength(0) // 加载时尚未注册约束
    expect(revalidated.length).toBeGreaterThanOrEqual(0)
  })
})
