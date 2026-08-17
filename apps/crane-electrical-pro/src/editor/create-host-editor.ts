import {
  createEditor,
  createEmptyDocumentJSON,
  createMemoryCatalog,
  cloneEnvironment
} from '@mh/3d-editor'
import type {
  CreateEditorOptions,
  EditorDocumentJSON,
  EditorSession,
  ProceduralModelResolver
} from '@mh/3d-editor'
import { panel, commonProceduralResolvers } from '@mh/3d-editor-assets/common'
import { CATALOG_ITEMS, createHostCatalog } from '@/catalog'
import { findCatalogItem } from '@/catalog/items'

export const DEFAULT_SCENE_BOUNDS = { width: 10, depth: 5, height: 2 }

export function createBlankSceneJSON(name = '起重机电气室'): EditorDocumentJSON {
  return createEmptyDocumentJSON({
    kind: 'scene',
    id: 'crane-room-default',
    name,
    bounds: { ...DEFAULT_SCENE_BOUNDS }
  })
}

const proceduralResolvers: ProceduralModelResolver[] = [...commonProceduralResolvers]

/**
 * 默认 10×5×2 场景：矩形房间、一排约 5 柜、门、LED、信息面板。
 * 无 mount，仅用于生成 JSON。
 */
export async function createDefaultSceneJSON(): Promise<EditorDocumentJSON> {
  const editor = await createEditor({
    catalog: createMemoryCatalog(CATALOG_ITEMS),
    document: createBlankSceneJSON(),
    procedural: {
      resolvers: proceduralResolvers
    }
  })

  const doc = editor.document
  doc.createRectRoom({ height: DEFAULT_SCENE_BOUNDS.height, thickness: 0.2 })

  const lv = findCatalogItem('cab-lv')!
  const ctrl = findCatalogItem('cab-ctrl')!
  const door = findCatalogItem('fix-door')!
  const led = findCatalogItem('fix-led')!
  const camera = findCatalogItem('fix-camera')!
  const panelItem = findCatalogItem('ui-info-panel')!

  const cabinetXs = [-3.2, -1.6, 0, 1.6, 3.2]
  cabinetXs.forEach((x, index) => {
    const item = index % 2 === 0 ? lv : ctrl
    const twin =
      index === 0
        ? {
            twin: {
              id: 'C-01',
              points: [
                { key: 'temp', alias: '柜温' },
                { key: 'voltage' },
                { key: 'current' }
              ],
              rules: [
                {
                  id: 'rule-overtemp',
                  name: '过温故障',
                  when: { point: 'temp', op: 'gt' as const, value: 60 },
                  then: { slots: { highlight: 'fault' } }
                }
              ]
            }
          }
        : index === 1
          ? {
              twin: {
                id: 'C-02',
                points: [
                  { key: 'alarm', alias: '告警' },
                  { key: 'temp' },
                  { key: 'voltage' }
                ],
                rules: [
                  {
                    id: 'rule-alarm',
                    name: '告警码',
                    when: { point: 'alarm', op: 'eq' as const, value: 1 },
                    then: { slots: { highlight: 'warning' } }
                  }
                ]
              }
            }
          : index === 2
            ? {
                twin: {
                  id: 'C-03',
                  points: [{ key: 'temp' }, { key: 'voltage' }, { key: 'current' }],
                  rules: [
                    {
                      id: 'rule-warn-temp',
                      name: '高温预警',
                      when: { point: 'temp', op: 'gt' as const, value: 50 },
                      then: { slots: { highlight: 'warning' } }
                    }
                  ]
                }
              }
            : undefined

    doc.commands.placeItem(item, {
      position: [x, 0, -1.2],
      rotation: [0, 0, 0],
      name: index % 2 === 0 ? `低压柜-${index + 1}` : `控制柜-${index + 1}`,
      props: {
        ratedVoltage: 380,
        ratedCurrent: index % 2 === 0 ? 250 : 100,
        status: 'normal',
        deviceCode: `C-${String(index + 1).padStart(2, '0')}`,
        ...twin
      },
      select: false
    })
  })

  doc.commands.placeItem(door, {
    position: [0, 0, 2.42],
    rotation: [0, 0, 0],
    name: '大门',
    select: false
  })

  doc.commands.placeItem(led, {
    position: [-2, 1.9, 0],
    name: 'LED_1',
    select: false
  })
  doc.commands.placeItem(led, {
    position: [2, 1.9, 0],
    name: 'LED_2',
    select: false
  })

  doc.commands.placeItem(camera, {
    position: [-4.5, 1.7, 2.2],
    name: '摄像头_1',
    select: false
  })

  const panelA = panel.cloneContent(panel.createDefaultContent())
  panelA.elements.forEach(el => {
    if (el.id === 'value' && el.type === 'text') el.text = '7618'
    if (el.id === 'title' && el.type === 'text') el.text = '降压变电站1#设备变压设备'
  })
  doc.commands.placeItem(panelItem, {
    position: [-1.6, 0.15, -0.35],
    name: '信息面板-A',
    props: { panel: panelA },
    select: false
  })

  const panelB = panel.cloneContent(panel.createDefaultContent())
  panelB.elements.forEach(el => {
    if (el.id === 'value' && el.type === 'text') el.text = '9843'
    if (el.id === 'title' && el.type === 'text') el.text = '降压变电站1#设备变压设备'
  })
  doc.commands.placeItem(panelItem, {
    position: [1.6, 0.15, -0.35],
    name: '信息面板-B',
    props: { panel: panelB },
    select: false
  })

  const env = cloneEnvironment(doc.environment)
  env.defaultView = {
    type: 'orbit',
    position: [7.5, 5.5, 8.5],
    target: [0, 0.9, 0],
    fov: 45,
    minDistance: 1,
    maxDistance: 80
  }
  env.background = { type: 'color', value: '#0C1420' }
  doc.commands.setEnvironment(env)

  const json = doc.toJSON()
  editor.dispose()
  return json
}

export type HostEditorOptions = {
  document: EditorDocumentJSON
  canvas2d?: HTMLElement | null
  canvas3d?: HTMLElement | null
  readonly?: boolean
  onDenied?: (reason: string) => void
}

export async function createHostEditor(options: HostEditorOptions): Promise<EditorSession> {
  const opts: CreateEditorOptions = {
    catalog: createHostCatalog(),
    document: options.document,
    mount: {
      canvas2d: options.canvas2d ?? undefined,
      canvas3d: options.canvas3d ?? undefined
    },
    viewport3d: {
      readonly: options.readonly ?? false,
      hoverOutline: !options.readonly
    },
    procedural: {
      resolvers: proceduralResolvers
    },
    interaction: options.readonly
      ? undefined
      : {
          transformModes: ['translate', 'rotate', 'scale'],
          snapEnabled: true,
          collisionEnabled: true
        },
    onDenied: options.onDenied
  }
  return createEditor(opts)
}
