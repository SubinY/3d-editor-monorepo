import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { componentStore, type ComponentCategory, type ComponentKind } from '@/stores/component-store'
import { resourceStore } from '@/stores/resource-store'

interface SeedSymbolDefinition {
  label: string
  color: string
  terminals?: Array<{ edge: 'top' | 'bottom' | 'left' | 'right'; count: number }>
}

interface SeedComponentDefinition {
  key: string
  name: string
  category: ComponentCategory
  kind: ComponentKind
  color: string
  symbol: SeedSymbolDefinition
  panelMm?: [number, number]
  buildModel: () => THREE.Object3D
}

const SEED_VERSION = 'seed-v7-2026-02-26'
const SEED_MARKER_KEY = 'demo-view-seed-version'
const MM_TO_M = 0.001

function modelResourceId(key: string): string {
  return `seed-model-${key}`
}

function symbolResourceId(key: string): string {
  return `seed-symbol-${key}`
}

function componentId(key: string): string {
  return `seed-component-${key}`
}

function createMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.25,
    roughness: 0.62
  })
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  color: string,
  position: [number, number, number]
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), createMaterial(color))
  mesh.position.set(position[0], position[1], position[2])
  parent.add(mesh)
  return mesh
}

function addCylinder(
  parent: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: string,
  position: [number, number, number]
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20), createMaterial(color))
  mesh.position.set(position[0], position[1], position[2])
  parent.add(mesh)
  return mesh
}

/** 构建半开门空心机柜：背板作安装面，正面完全敞开，仅右侧铰链半开柜门，无封闭前板 */
function buildHollowCabinetWithOpenDoor(options: {
  width: number
  height: number
  depth: number
  wallThickness?: number
  frameColor?: string
  doorColor?: string
  hingeColor?: string
  doorOpenAngle?: number
}): THREE.Object3D {
  const tw = options.wallThickness ?? 0.018
  const w = options.width
  const h = options.height
  const d = options.depth
  const frameColor = options.frameColor ?? '#2f3b56'
  const doorColor = options.doorColor ?? '#4a5d7a'
  const hingeColor = options.hingeColor ?? '#9fb4dd'
  const doorAngle = options.doorOpenAngle ?? -Math.PI / 2

  const group = new THREE.Group()
  const halfW = w / 2
  const halfD = d / 2
  const cy = h / 2 - tw / 2

  // 空心柜体：背板（即安装板，元器件装在此面）、左右侧板、底板、顶板，正面无板
  addBox(group, [w - tw * 2, h - tw, tw], frameColor, [0, cy, -halfD + tw / 2])
  addBox(group, [tw, h - tw, d - tw], frameColor, [-halfW + tw / 2, cy, -tw / 2])
  addBox(group, [tw, h - tw, d - tw], frameColor, [halfW - tw / 2, cy, -tw / 2])
  addBox(group, [w - tw * 2, tw, d - tw], frameColor, [0, tw / 2, -tw / 2])
  addBox(group, [w - tw * 2, tw, d - tw], frameColor, [0, h - tw / 2, -tw / 2])

  // 仅半开柜门（铰链在右侧），无封闭前板
  const doorW = w - tw * 2 - 0.04
  const doorH = h - tw * 2 - 0.04
  const tp = 0.016
  const hingeX = halfW - tw - 0.02
  const hingeZ = halfD - tw - 0.01
  const doorGeo = new THREE.BoxGeometry(doorW, doorH, tp)
  doorGeo.translate(doorW / 2, 0, 0)
  const doorMesh = new THREE.Mesh(doorGeo, createMaterial(doorColor))
  doorMesh.name = 'door'
  doorMesh.position.set(hingeX, cy, hingeZ)
  doorMesh.rotation.y = doorAngle
  group.add(doorMesh)

  addCylinder(group, 0.01, 0.01, 0.08, hingeColor, [hingeX - 0.015, cy, hingeZ + 0.01]).rotation.z = Math.PI / 2

  return group
}

function buildFloorCabinet(): THREE.Object3D {
  const group = buildHollowCabinetWithOpenDoor({
    width: 0.8,
    height: 2.2,
    depth: 0.6,
    frameColor: '#2f3b56',
    doorColor: '#4a5d7a',
    hingeColor: '#9fb4dd',
    doorOpenAngle: -Math.PI / 2
  })
  group.name = '落地柜'
  return group
}

function buildWallCabinet(): THREE.Object3D {
  const group = buildHollowCabinetWithOpenDoor({
    width: 0.6,
    height: 1.4,
    depth: 0.35,
    frameColor: '#39486b',
    doorColor: '#5a6d91',
    hingeColor: '#c7d5ef',
    doorOpenAngle: -Math.PI / 2
  })
  group.name = '壁挂柜'
  return group
}

function buildBreaker(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.17, 0.24, 0.11], '#fafafa', [0, 0.12, 0])
  addBox(group, [0.13, 0.03, 0.1], '#2f3648', [0, 0.23, 0])
  addBox(group, [0.03, 0.05, 0.03], '#4c566f', [-0.05, 0.25, 0.02])
  addBox(group, [0.03, 0.05, 0.03], '#4c566f', [0, 0.25, 0.02])
  addBox(group, [0.03, 0.05, 0.03], '#4c566f', [0.05, 0.25, 0.02])
  group.name = '断路器'
  return group
}

function buildContactor(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.15, 0.2, 0.12], '#22314e', [0, 0.1, 0])
  addBox(group, [0.13, 0.08, 0.06], '#4a90e2', [0, 0.18, 0.03])
  addBox(group, [0.12, 0.015, 0.025], '#d7deed', [0, 0.02, 0.05])
  addBox(group, [0.12, 0.015, 0.025], '#d7deed', [0, 0.02, -0.05])
  group.name = '接触器'
  return group
}

function buildRelay(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.11, 0.15, 0.08], '#eaf2ff', [0, 0.075, 0])
  addBox(group, [0.07, 0.06, 0.03], '#64b5f6', [0, 0.13, 0.015])
  addCylinder(group, 0.005, 0.005, 0.02, '#8492a8', [-0.03, 0.01, 0.03])
  addCylinder(group, 0.005, 0.005, 0.02, '#8492a8', [0.03, 0.01, 0.03])
  addCylinder(group, 0.005, 0.005, 0.02, '#8492a8', [-0.03, 0.01, -0.03])
  addCylinder(group, 0.005, 0.005, 0.02, '#8492a8', [0.03, 0.01, -0.03])
  group.name = '继电器'
  return group
}

function buildTerminal4(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.16, 0.06, 0.06], '#ffca28', [0, 0.03, 0])
  for (let i = 0; i < 4; i += 1) {
    addCylinder(group, 0.006, 0.006, 0.02, '#455a64', [-0.06 + i * 0.04, 0.065, 0])
  }
  group.name = '端子排-4'
  return group
}

function buildTerminal8(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.28, 0.06, 0.06], '#ffb300', [0, 0.03, 0])
  for (let i = 0; i < 8; i += 1) {
    addCylinder(group, 0.005, 0.005, 0.02, '#37474f', [-0.12 + i * 0.034, 0.065, 0])
  }
  group.name = '端子排-8'
  return group
}

function buildMeter(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.16, 0.13, 0.08], '#2d3f65', [0, 0.065, 0])
  addBox(group, [0.12, 0.06, 0.01], '#9bd4ff', [0, 0.095, 0.041])
  addBox(group, [0.11, 0.012, 0.01], '#d8e6ff', [0, 0.04, 0.041])
  group.name = '数显仪表'
  return group
}

function buildLamp(): THREE.Object3D {
  const group = new THREE.Group()
  addCylinder(group, 0.04, 0.04, 0.03, '#455a64', [0, 0.015, 0])
  addCylinder(group, 0.028, 0.028, 0.025, '#4caf50', [0, 0.04, 0])
  group.name = '指示灯'
  return group
}

function buildPushButton(): THREE.Object3D {
  const group = new THREE.Group()
  addCylinder(group, 0.045, 0.045, 0.025, '#263238', [0, 0.012, 0])
  addCylinder(group, 0.03, 0.03, 0.028, '#ef5350', [0, 0.038, 0])
  group.name = '按钮开关'
  return group
}

function buildFan(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.14, 0.14, 0.06], '#37474f', [0, 0.07, 0])
  addCylinder(group, 0.045, 0.045, 0.01, '#90a4ae', [0, 0.07, 0.031])
  addCylinder(group, 0.008, 0.008, 0.02, '#263238', [0, 0.07, 0.031])
  group.name = '风扇模块'
  return group
}

function buildCableTrunking(): THREE.Object3D {
  const group = new THREE.Group()
  addBox(group, [0.3, 0.05, 0.08], '#607d8b', [0, 0.025, 0])
  addBox(group, [0.3, 0.008, 0.08], '#b0bec5', [0, 0.05, 0])
  group.name = '线槽'
  return group
}

const SEED_COMPONENTS: SeedComponentDefinition[] = [
  {
    key: 'cabinet-floor',
    name: '标准落地柜',
    category: 'structure',
    kind: 'cabinet',
    color: '#3f6ecf',
    symbol: { label: 'CAB-01', color: '#3f6ecf', terminals: [{ edge: 'bottom', count: 4 }] },
    panelMm: [800, 2200],
    buildModel: buildFloorCabinet
  },
  {
    key: 'cabinet-wall',
    name: '壁挂机柜',
    category: 'structure',
    kind: 'cabinet',
    color: '#4f7fe1',
    symbol: { label: 'CAB-02', color: '#4f7fe1', terminals: [{ edge: 'bottom', count: 4 }] },
    panelMm: [600, 1400],
    buildModel: buildWallCabinet
  },
  {
    key: 'breaker-3p',
    name: '断路器 3P',
    category: 'electrical',
    kind: 'part',
    color: '#e57373',
    symbol: { label: 'QF1', color: '#e57373', terminals: [{ edge: 'top', count: 3 }, { edge: 'bottom', count: 3 }] },
    buildModel: buildBreaker
  },
  {
    key: 'contactor-32a',
    name: '接触器 32A',
    category: 'electrical',
    kind: 'part',
    color: '#64b5f6',
    symbol: { label: 'KM1', color: '#64b5f6', terminals: [{ edge: 'top', count: 3 }, { edge: 'bottom', count: 3 }] },
    buildModel: buildContactor
  },
  {
    key: 'relay',
    name: '中间继电器',
    category: 'electrical',
    kind: 'part',
    color: '#9575cd',
    symbol: { label: 'KA1', color: '#9575cd', terminals: [{ edge: 'left', count: 2 }, { edge: 'right', count: 2 }] },
    buildModel: buildRelay
  },
  {
    key: 'terminal-4',
    name: '端子排 4位',
    category: 'electrical',
    kind: 'part',
    color: '#ffb74d',
    symbol: { label: 'XT4', color: '#ffb74d', terminals: [{ edge: 'top', count: 4 }, { edge: 'bottom', count: 4 }] },
    buildModel: buildTerminal4
  },
  {
    key: 'terminal-8',
    name: '端子排 8位',
    category: 'electrical',
    kind: 'part',
    color: '#ffa726',
    symbol: { label: 'XT8', color: '#ffa726', terminals: [{ edge: 'top', count: 8 }, { edge: 'bottom', count: 8 }] },
    buildModel: buildTerminal8
  },
  {
    key: 'meter',
    name: '数显仪表',
    category: 'electrical',
    kind: 'part',
    color: '#4db6ac',
    symbol: { label: 'PM1', color: '#4db6ac', terminals: [{ edge: 'bottom', count: 2 }] },
    buildModel: buildMeter
  },
  {
    key: 'indicator-lamp',
    name: '指示灯',
    category: 'auxiliary',
    kind: 'part',
    color: '#81c784',
    symbol: { label: 'HL1', color: '#81c784', terminals: [{ edge: 'bottom', count: 2 }] },
    buildModel: buildLamp
  },
  {
    key: 'push-button',
    name: '按钮开关',
    category: 'auxiliary',
    kind: 'part',
    color: '#ef5350',
    symbol: { label: 'SB1', color: '#ef5350', terminals: [{ edge: 'bottom', count: 2 }] },
    buildModel: buildPushButton
  },
  {
    key: 'fan-module',
    name: '风扇模块',
    category: 'auxiliary',
    kind: 'part',
    color: '#90a4ae',
    symbol: { label: 'FAN', color: '#90a4ae', terminals: [{ edge: 'bottom', count: 2 }] },
    buildModel: buildFan
  },
  {
    key: 'cable-trunking',
    name: '线槽',
    category: 'structure',
    kind: 'part',
    color: '#78909c',
    symbol: { label: 'TRK', color: '#78909c', terminals: [{ edge: 'left', count: 1 }, { edge: 'right', count: 1 }] },
    buildModel: buildCableTrunking
  }
]

function terminalSvg(symbol: SeedSymbolDefinition, width: number, height: number): string {
  const terminalNodes: string[] = []
  const radius = 4
  const edgeInset = 8

  for (const terminal of symbol.terminals || []) {
    for (let i = 0; i < terminal.count; i += 1) {
      const ratio = (i + 1) / (terminal.count + 1)
      let x = width * ratio
      let y = height * ratio
      if (terminal.edge === 'top') y = edgeInset
      if (terminal.edge === 'bottom') y = height - edgeInset
      if (terminal.edge === 'left') x = edgeInset
      if (terminal.edge === 'right') x = width - edgeInset
      terminalNodes.push(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}" fill="#ffffff" stroke="#1a2237" stroke-width="1.4" />`
      )
    }
  }
  return terminalNodes.join('')
}

function createSymbolSvg(symbol: SeedSymbolDefinition): string {
  const width = 180
  const height = 96
  const terminalMarkup = terminalSvg(symbol, width, height)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect x="1" y="1" width="178" height="94" rx="8" fill="#0f172c" stroke="#3d4f73" stroke-width="2"/>',
    `<rect x="10" y="14" width="160" height="68" rx="6" fill="${symbol.color}" fill-opacity="0.18" stroke="${symbol.color}" stroke-width="2"/>`,
    `<text x="90" y="53" text-anchor="middle" dominant-baseline="middle" fill="#d7e3ff" font-family="Arial, sans-serif" font-size="18" font-weight="700">${symbol.label}</text>`,
    terminalMarkup,
    '</svg>'
  ].join('')
}

async function exportAsGlb(root: THREE.Object3D): Promise<Blob> {
  const exporter = new GLTFExporter()
  const binary = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      root,
      result => {
        if (result instanceof ArrayBuffer) resolve(result)
        else reject(new Error('种子模型导出失败：未返回二进制 GLB'))
      },
      error => reject(error ?? new Error('种子模型导出失败')),
      { binary: true }
    )
  })
  return new Blob([binary], { type: 'model/gltf-binary' })
}

function collectStats(root: THREE.Object3D): { nodeCount: number; meshCount: number; triangleCount: number; size: [number, number, number] } {
  let nodeCount = 0
  let meshCount = 0
  let triangleCount = 0
  root.updateMatrixWorld(true)
  root.traverse(node => {
    nodeCount += 1
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    meshCount += 1
    const geometry = mesh.geometry as THREE.BufferGeometry
    if (geometry.index) triangleCount += Math.floor(geometry.index.count / 3)
    else {
      const pos = geometry.getAttribute('position')
      if (pos) triangleCount += Math.floor(pos.count / 3)
    }
  })
  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  if (!box.isEmpty()) box.getSize(size)
  return {
    nodeCount,
    meshCount,
    triangleCount,
    size: [size.x, size.y, size.z]
  }
}

async function upsertSeedComponent(seed: SeedComponentDefinition): Promise<void> {
  const modelRoot = seed.buildModel()
  const modelStats = collectStats(modelRoot)
  const modelBlob = await exportAsGlb(modelRoot)
  const symbolBlob = new Blob([createSymbolSvg(seed.symbol)], { type: 'image/svg+xml;charset=utf-8' })

  const modelResource = await resourceStore.put({
    id: modelResourceId(seed.key),
    name: `${seed.key}.glb`,
    mime: 'model/gltf-binary',
    blob: modelBlob
  })
  const symbolResource = await resourceStore.put({
    id: symbolResourceId(seed.key),
    name: `${seed.key}.svg`,
    mime: 'image/svg+xml',
    blob: symbolBlob
  })

  const now = Date.now()
  const existing = componentStore.get(componentId(seed.key))
  componentStore.save({
    id: componentId(seed.key),
    name: seed.name,
    category: seed.category,
    kind: seed.kind,
    cabinetMeta: seed.panelMm
      ? {
          panel: {
            widthMm: seed.panelMm[0],
            heightMm: seed.panelMm[1],
            origin: 'top-left',
            axis: 'xy'
          },
          panelOrigin3d:
            seed.key === 'cabinet-floor'
              ? [0, 1.09, -0.282]
              : seed.key === 'cabinet-wall'
                ? [0, 0.68, -0.158]
                : undefined
        }
      : undefined,
    resourceId: modelResource.id,
    symbolResourceId: symbolResource.id,
    displayColor: seed.color,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    meshCount: modelStats.meshCount,
    nodeCount: modelStats.nodeCount,
    triangleCount: modelStats.triangleCount,
    size: modelStats.size,
    focusEnabled: false,
    importProfile: {
      sourceFormat: 'seed-glb',
      normalizedToGlb: true,
      cleanups: ['seed-generated'],
      aggressiveOptimization: false,
      seedCatalog: SEED_VERSION,
      seedKey: seed.key,
      seedScaleMm: MM_TO_M
    }
  })
}

export async function bootstrapSeedResources(): Promise<void> {
  if (typeof window === 'undefined') return
  const marker = localStorage.getItem(SEED_MARKER_KEY)
  const seedCount = componentStore
    .list()
    .filter(item => item.importProfile?.seedCatalog === SEED_VERSION)
    .length
  if (marker === SEED_VERSION && seedCount >= SEED_COMPONENTS.length) return

  for (const seed of SEED_COMPONENTS) {
    await upsertSeedComponent(seed)
  }
  localStorage.setItem(SEED_MARKER_KEY, SEED_VERSION)
}

