import {
  createEmptyDocumentJSON,
  createEditor,
  createMemoryCatalog,
  cloneEnvironment
} from '@mh/3d-editor'
import type { EditorDocumentJSON } from '@mh/3d-editor'
import { UX_DEMO_CATALOG } from './catalog'
import { createUxDemoProceduralResolvers } from './models/registry'

/** 构建接近设计稿的示意电柜室 Document（内存，不落库） */
export async function buildUxDemoSceneJSON(): Promise<EditorDocumentJSON> {
  const catalog = createMemoryCatalog(UX_DEMO_CATALOG)
  const draft = createEmptyDocumentJSON({
    kind: 'scene',
    id: 'ux-demo-scene',
    name: '电气室 A',
    bounds: { width: 14, depth: 11, height: 3.2 }
  })

  const env = cloneEnvironment(draft.environment)
  env.background = { type: 'color', value: '#0a1018' }
  env.helpers = { grid: true, enclosure: 'none' }
  env.floor = {
    visible: true,
    coverage: 'closedRooms',
    color: '#3a4554',
    opacity: 1,
    mapRepeat: 2
  }
  env.wall = {
    color: '#6a7686',
    opacity: 1
  }
  env.lights = [
    { type: 'ambient', color: '#c5d4e6', intensity: 0.7 },
    {
      type: 'directional',
      color: '#ffffff',
      intensity: 1.35,
      position: [6, 12, 8],
      castShadow: true
    },
    {
      type: 'directional',
      color: '#a8c0e0',
      intensity: 0.35,
      position: [-6, 8, -4],
      castShadow: false
    }
  ]
  env.shadows = { enabled: true, type: 'pcfsoft' }
  env.defaultView = {
    type: 'orbit',
    position: [8.5, 6.8, 10.2],
    target: [0, 0.5, 0.2],
    fov: 38,
    minDistance: 2,
    maxDistance: 40
  }
  draft.environment = env

  const editor = await createEditor({
    catalog,
    document: draft,
    procedural: { resolvers: createUxDemoProceduralResolvers() },
    interaction: {
      snapEnabled: true,
      collisionEnabled: false,
      transformModes: ['translate', 'rotate']
    }
  })

  const doc = editor.document
  doc.createRectRoom({ height: 3.0, thickness: 0.2 })
  doc.collisionEnabled = true

  const main = UX_DEMO_CATALOG.find(i => i.id === 'ux-cabinet-main')!
  const ups = UX_DEMO_CATALOG.find(i => i.id === 'ux-cabinet-ups')!
  const dist = UX_DEMO_CATALOG.find(i => i.id === 'ux-cabinet-dist')!
  const ac = UX_DEMO_CATALOG.find(i => i.id === 'ux-ac')!
  const door = UX_DEMO_CATALOG.find(i => i.id === 'ux-door')!

  // 左墙排柜（面向 +X）
  ;[-4, -2, 0, 2, 4].forEach((z, i) => {
    doc.commands.placeItem(i % 2 === 0 ? main : ups, {
      position: [-5.5, 0, z],
      rotation: [0, Math.PI / 2, 0],
      name: `左列柜-${i + 1}`,
      select: false
    })
  })

  // 右墙排柜（面向 -X）
  ;[-3.5, -1.5, 0.5, 2.5, 4.5].forEach((z, i) => {
    doc.commands.placeItem(main, {
      position: [5.5, 0, z],
      rotation: [0, -Math.PI / 2, 0],
      name: `右列柜-${i + 1}`,
      select: false
    })
  })

  // 中岛选中目标（设计稿高亮柜）
  const focus = doc.commands.placeItem(main, {
    position: [0.2, 0, -0.4],
    rotation: [0, 0.2, 0],
    name: '电柜 A-12',
    select: false
  })
  doc.commands.placeItem(main, {
    position: [1.4, 0, -0.35],
    rotation: [0, 0.2, 0],
    name: '电柜 A-13',
    select: false
  })

  doc.commands.placeItem(dist, {
    position: [-0.8, 0, 2.6],
    rotation: [0, 0.5, 0],
    name: '配电箱',
    select: false
  })

  doc.commands.placeItem(ac, {
    position: [-3.8, 0, 4.4],
    rotation: [0, 0, 0],
    name: '精密空调',
    select: false
  })

  // 后墙门（-Z）
  doc.commands.placeItem(door, {
    position: [0, 0, -5.45],
    rotation: [0, 0, 0],
    name: '房间门',
    select: false
  })

  const json = doc.toJSON()
  if (focus.node) {
    json.metadata = { ...(json.metadata ?? {}), focusNodeId: focus.node.id }
  }
  editor.dispose()
  return json
}
