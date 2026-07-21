import { ref, shallowRef, inject, provide, computed } from 'vue'
import * as THREE from 'three'
import {
  CoreContext,
  createBox,
  createStandardMaterial,
  EditorEvents,
  type ObjectSchema
} from '@3d-editor/engine'
import { basicPreset } from '@3d-editor/presets'
import { DEFAULT_SCENE_ENV } from '@/config/scene-env'
import { createSnapPlugin } from '@3d-editor/extensions'
import type { AssetEditorMode, PartSpec, TransformMode, TreeNodeData } from '../types'
import { assetStore, type AssetRecord, type Layout2DData, type Layout2DItem } from '@/stores/asset-store'
import { componentStore, type ComponentRecord } from '@/stores/component-store'
import { loadModelFromResource } from '@/services/model-resource-service'

const EDITOR_KEY = Symbol('asset-editor')

interface CollisionIssue {
  id: string
  aId: string
  aName: string
  bId: string
  bName: string
}

interface DrillNotice {
  message: string
}

interface CameraSnapshot {
  position: THREE.Vector3
  target: THREE.Vector3
}

const DEFAULT_BOARD_MM: [number, number] = [800, 2200]
const MM_TO_M = 0.001
const COLLISION_ENABLED = false

const BUILTIN_PART_SPECS: PartSpec[] = [
  { id: 'din-rail', name: 'DIN导轨', icon: 'mdi:minus-thick', color: '#90a4ae', category: 'structure', kind: 'part', size: [5, 0.3, 0.4], footprintMm: [5000, 400], source: 'builtin', focusEnabled: false },
  { id: 'breaker', name: '断路器', icon: 'mdi:electric-switch', color: '#e53935', category: 'electrical', kind: 'part', size: [1.2, 1.8, 1], footprintMm: [1200, 1000], source: 'builtin', focusEnabled: false },
  { id: 'contactor', name: '接触器', icon: 'mdi:connection', color: '#1e88e5', category: 'electrical', kind: 'part', size: [1.4, 2, 1.2], footprintMm: [1400, 1200], source: 'builtin', focusEnabled: false },
  { id: 'relay', name: '继电器', icon: 'mdi:chip', color: '#8e24aa', category: 'electrical', kind: 'part', size: [0.8, 1.2, 0.8], footprintMm: [800, 800], source: 'builtin', focusEnabled: false },
  { id: 'terminal', name: '端子排', icon: 'mdi:dots-horizontal', color: '#f9a825', category: 'electrical', kind: 'part', size: [4, 0.6, 0.5], footprintMm: [4000, 500], source: 'builtin', focusEnabled: false },
  { id: 'cable-tray', name: '电缆槽', icon: 'mdi:tray-full', color: '#546e7a', category: 'auxiliary', kind: 'part', size: [5, 0.8, 1.2], footprintMm: [5000, 1200], source: 'builtin', focusEnabled: false },
  { id: 'nameplate', name: '铭牌', icon: 'mdi:label-outline', color: '#bdbdbd', category: 'auxiliary', kind: 'part', size: [2, 0.8, 0.05], footprintMm: [2000, 50], source: 'builtin', focusEnabled: false }
]

function createBuiltinPartMesh(spec: PartSpec): THREE.Object3D {
  const group = new THREE.Group()
  group.name = spec.name

  const [w, h, d] = spec.size
  const geo = createBox(w, h, d)
  const mat = createStandardMaterial(spec.color)
  mat.metalness = 0.4
  mat.roughness = 0.55

  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = h / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  group.userData.partId = spec.id
  group.userData.partName = spec.name
  group.userData.focusEnabled = spec.focusEnabled ?? false

  return group
}

function buildTreeNode(obj: THREE.Object3D): TreeNodeData {
  return {
    id: obj.uuid,
    name: obj.name || obj.type,
    type: obj.type,
    visible: obj.visible,
    children: obj.children
      .filter(c => !c.userData?.nonSelectable && (c.type === 'Mesh' || c.type === 'Group'))
      .map(c => buildTreeNode(c))
  }
}

function rebuildGeometry(geo: any): THREE.BufferGeometry {
  const p = geo.parameters || {}
  switch (geo.type) {
    case 'box': return createBox(p.width ?? 1, p.height ?? 1, p.depth ?? 1)
    case 'sphere': return new THREE.SphereGeometry(p.radius ?? 1, p.widthSegments ?? 16, p.heightSegments ?? 12)
    case 'plane': return new THREE.PlaneGeometry(p.width ?? 1, p.height ?? 1)
    default: return createBox(1, 1, 1)
  }
}

function rebuildMaterial(mat: any): THREE.Material {
  if (!mat) return createStandardMaterial('#999999')
  if (Array.isArray(mat)) return rebuildMaterial(mat[0])
  const m = createStandardMaterial(mat.color || '#999999')
  m.metalness = mat.metalness ?? 0.3
  m.roughness = mat.roughness ?? 0.6
  m.opacity = mat.opacity ?? 1
  m.transparent = mat.transparent ?? false
  return m
}

function safeFootprintFromComponent(record: ComponentRecord): [number, number] {
  const [sx, , sz] = record.size
  const widthMm = Math.max(1, Math.round((sx || 1) * 1000))
  const heightMm = Math.max(1, Math.round((sz || 1) * 1000))
  return [widthMm, heightMm]
}

function getCabinetPanelSize(record?: ComponentRecord): [number, number] {
  if (!record) return DEFAULT_BOARD_MM
  const panel = record.cabinetMeta?.panel
  if (panel && panel.widthMm > 0 && panel.heightMm > 0) {
    return [panel.widthMm, panel.heightMm]
  }
  return safeFootprintFromComponent(record)
}

/** 获取机柜安装板中心在场景中的 3D 坐标 (米)，默认为落地柜安装板位置 */
function getPanelOrigin3d(cabinet?: ComponentRecord): [number, number, number] {
  const origin = cabinet?.cabinetMeta?.panelOrigin3d
  if (origin && origin.length >= 3) return [origin[0], origin[1], origin[2]]
  return [0, 1.05, 0.31]
}

function nextLayoutItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `layout-${crypto.randomUUID()}`
  }
  return `layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createAssetEditor() {
  const ctx = shallowRef<CoreContext | null>(null)
  const mode = ref<AssetEditorMode>('2d')
  const currentTool = ref<TransformMode>('translate')
  const selectedIds = ref<string[]>([])
  const sceneTree = ref<TreeNodeData[]>([])
  const currentAssetId = ref<string | null>(null)
  const currentAssetName = ref('')
  const cabinetComponentId = ref<string | null>(null)
  const boardSizeMm = ref<[number, number]>([...DEFAULT_BOARD_MM])
  const layoutItems = ref<Layout2DItem[]>([])
  const selectedLayoutItemId = ref<string | null>(null)
  const selectedLayoutItem = computed(() =>
    layoutItems.value.find(item => item.id === selectedLayoutItemId.value) || null
  )
  const hasUnsavedChanges = ref(false)

  const collisionIssues = ref<CollisionIssue[]>([])
  const drillActive = ref(false)
  const drillTargetId = ref<string | null>(null)
  const drillTargetName = ref('')
  const notice = ref<DrillNotice | null>(null)

  const sceneEnv = ref({
    backgroundType: 'color' as 'color' | 'image' | 'panorama',
    backgroundColor: DEFAULT_SCENE_ENV.background,
    ambientIntensity: DEFAULT_SCENE_ENV.ambientIntensity,
    dirIntensity: DEFAULT_SCENE_ENV.dirIntensity,
    environmentIntensity: DEFAULT_SCENE_ENV.environment.intensity
  })

  const importedParts = ref<PartSpec[]>([])
  const importedPartSpecs = computed(() =>
    importedParts.value.filter(item => item.kind !== 'cabinet')
  )
  const partSpecs = computed(() =>
    importedPartSpecs.value.length > 0 ? importedPartSpecs.value : BUILTIN_PART_SPECS
  )

  const collisionHighlighted = new Set<THREE.Object3D>()
  const collisionMaterialState = new WeakMap<THREE.Material, { emissive?: number; emissiveIntensity?: number }>()
  const drillMaterialState = new WeakMap<THREE.Material, { transparent: boolean; opacity: number }>()
  let drillCameraSnapshot: CameraSnapshot | null = null
  let collisionTimer: ReturnType<typeof setTimeout> | null = null

  const refreshImportedParts = () => {
    importedParts.value = componentStore.list().map(c => ({
      id: c.id,
      name: c.name,
      icon: 'mdi:file-cube-outline',
      color: c.displayColor || '#2de3a2',
      category: c.category,
      kind: c.kind ?? 'part',
      size: c.size,
      footprintMm: safeFootprintFromComponent(c),
      source: 'imported' as const,
      resourceId: c.resourceId,
      symbolResourceId: c.symbolResourceId,
      focusEnabled: c.focusEnabled ?? false
    }))
  }
  // 2D 模式下不会立即初始化 3D 上下文，这里先加载一次组件映射，避免首屏仍显示旧内置库。
  refreshImportedParts()

  const init = async (container: HTMLElement) => {
    const context = new CoreContext({
      container,
      rendererOptions: { antialias: true, alpha: true },
      plugins: [
        createSnapPlugin({ gridSize: 0.5, angleStep: THREE.MathUtils.degToRad(15) })
      ]
    })

    await context.applyPreset(basicPreset, {
      ...DEFAULT_SCENE_ENV,
      grid: null
    })

    context.scene.add(context.transform.controls)
    context.transform.controls.userData.nonSelectable = true
    context.transform.controls.traverse((child: THREE.Object3D) => {
      child.userData.nonSelectable = true
    })

    context.cameraManager.camera.position.set(3, 2.5, 4)
    if (context.orbit) {
      context.orbit.controls.target.set(0, 1.1, 0)
      context.orbit.controls.update()
    }

    context.axisHelper.setEnabled(false)
    if (context.axisHelper.worldAxis.parent) {
      context.axisHelper.worldAxis.removeFromParent()
    }

    context.selection.onSelectionChanged = selection => {
      selectedIds.value = selection.map(o => o.uuid)
    }

    context.eventBus.on(EditorEvents.OBJECT_ADDED, () => {
      refreshTree()
      runCollisionCheck()
      hasUnsavedChanges.value = true
    })
    context.eventBus.on(EditorEvents.OBJECT_REMOVED, () => {
      refreshTree()
      runCollisionCheck()
      hasUnsavedChanges.value = true
    })
    context.eventBus.on(EditorEvents.OBJECT_TRANSFORMED, payload => {
      hasUnsavedChanges.value = true
      const done = !!(payload && typeof payload === 'object' && 'before' in (payload as any) && 'after' in (payload as any))
      if (done) {
        runCollisionCheck()
      } else {
        scheduleCollisionCheck()
      }
    })

    ctx.value = context
    refreshImportedParts()
    refreshTree()
  }

  const updateSceneEnv = async (patch?: Partial<typeof sceneEnv.value>) => {
    if (!ctx.value) return
    if (patch) sceneEnv.value = { ...sceneEnv.value, ...patch }
    const env = sceneEnv.value
    await ctx.value.applyPreset(basicPreset, {
      background: env.backgroundType === 'color' ? env.backgroundColor : DEFAULT_SCENE_ENV.background,
      ambientIntensity: env.ambientIntensity,
      dirIntensity: env.dirIntensity,
      dirPosition: DEFAULT_SCENE_ENV.dirPosition,
      environment: { url: DEFAULT_SCENE_ENV.environment.url, intensity: env.environmentIntensity },
      grid: null
    })
  }

  const getPartSpec = (partId: string): PartSpec | undefined =>
    partSpecs.value.find(item => item.id === partId) ||
    BUILTIN_PART_SPECS.find(item => item.id === partId)

  const setCabinetComponent = (componentId: string | null) => {
    cabinetComponentId.value = componentId
    if (!componentId) {
      boardSizeMm.value = [...DEFAULT_BOARD_MM]
      return
    }
    const cabinet = componentStore.get(componentId)
    boardSizeMm.value = getCabinetPanelSize(cabinet)
  }

  const addLayoutItem = (partId: string) => {
    const spec = getPartSpec(partId)
    if (!spec) return
    const footprint = spec.footprintMm || [100, 100]
    const [boardW, boardH] = boardSizeMm.value
    const next: Layout2DItem = {
      id: nextLayoutItemId(),
      componentId: partId,
      name: spec.name,
      xMm: Math.max(0, (boardW - footprint[0]) / 2),
      yMm: Math.max(0, (boardH - footprint[1]) / 2),
      rotationDeg: 0,
      widthMm: footprint[0],
      heightMm: footprint[1],
      color: spec.color,
      focusEnabled: spec.focusEnabled ?? false
    }
    layoutItems.value = [...layoutItems.value, next]
    selectedLayoutItemId.value = next.id
    hasUnsavedChanges.value = true
  }

  const updateLayoutItem = (itemId: string, patch: Partial<Layout2DItem>) => {
    layoutItems.value = layoutItems.value.map(item => {
      if (item.id !== itemId) return item
      const widthMm = patch.widthMm ?? item.widthMm
      const heightMm = patch.heightMm ?? item.heightMm
      const [boardW, boardH] = boardSizeMm.value
      const xMm = Math.min(Math.max(0, patch.xMm ?? item.xMm), Math.max(0, boardW - widthMm))
      const yMm = Math.min(Math.max(0, patch.yMm ?? item.yMm), Math.max(0, boardH - heightMm))
      return {
        ...item,
        ...patch,
        widthMm,
        heightMm,
        xMm,
        yMm
      }
    })
    hasUnsavedChanges.value = true
  }

  const removeLayoutItem = (itemId: string) => {
    layoutItems.value = layoutItems.value.filter(item => item.id !== itemId)
    if (selectedLayoutItemId.value === itemId) selectedLayoutItemId.value = null
    hasUnsavedChanges.value = true
  }

  const selectLayoutItem = (itemId: string | null) => {
    selectedLayoutItemId.value = itemId
  }

  const scheduleCollisionCheck = () => {
    if (collisionTimer) clearTimeout(collisionTimer)
    collisionTimer = setTimeout(() => runCollisionCheck(), 100)
  }

  const collectEditableObjects = (): THREE.Object3D[] => {
    if (!ctx.value) return []
    return ctx.value.scene.children.filter(o => !o.userData?.nonSelectable)
  }

  const clearCollisionHighlight = () => {
    collisionHighlighted.forEach(obj => {
      obj.traverse(node => {
        const mesh = node as THREE.Mesh
        if (!mesh.isMesh || !mesh.material) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach(mat => {
          const state = collisionMaterialState.get(mat)
          if (!state) return
          const target = mat as THREE.MeshStandardMaterial
          if (state.emissive !== undefined && target.emissive) target.emissive.setHex(state.emissive)
          if (state.emissiveIntensity !== undefined) target.emissiveIntensity = state.emissiveIntensity
        })
      })
    })
    collisionHighlighted.clear()
  }

  const applyCollisionHighlight = (objects: THREE.Object3D[]) => {
    clearCollisionHighlight()
    objects.forEach(obj => {
      collisionHighlighted.add(obj)
      obj.traverse(node => {
        const mesh = node as THREE.Mesh
        if (!mesh.isMesh || !mesh.material) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach(mat => {
          const target = mat as THREE.MeshStandardMaterial
          if (!target.emissive) return
          if (!collisionMaterialState.has(mat)) {
            collisionMaterialState.set(mat, {
              emissive: target.emissive.getHex(),
              emissiveIntensity: target.emissiveIntensity
            })
          }
          target.emissive.setHex(0xff3344)
          target.emissiveIntensity = 0.85
        })
      })
    })
  }

  const runCollisionCheck = () => {
    if (!ctx.value) return
    if (!COLLISION_ENABLED) {
      collisionIssues.value = []
      clearCollisionHighlight()
      return
    }
    const objects = collectEditableObjects()
    const boxes = objects.map(obj => ({ obj, box: new THREE.Box3().setFromObject(obj) }))
    const issues: CollisionIssue[] = []
    const collided = new Set<THREE.Object3D>()

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]
        if (a.box.isEmpty() || b.box.isEmpty()) continue
        if (!a.box.intersectsBox(b.box)) continue
        issues.push({
          id: `${a.obj.uuid}-${b.obj.uuid}`,
          aId: a.obj.uuid,
          aName: a.obj.name || a.obj.type,
          bId: b.obj.uuid,
          bName: b.obj.name || b.obj.type
        })
        collided.add(a.obj)
        collided.add(b.obj)
      }
    }

    collisionIssues.value = issues
    applyCollisionHighlight(Array.from(collided))
  }

  const fitCameraToScene = () => {
    if (!ctx.value) return
    const objects = collectEditableObjects()
    if (objects.length === 0) return
    const box = new THREE.Box3()
    objects.forEach(obj => box.union(new THREE.Box3().setFromObject(obj)))
    if (box.isEmpty()) return
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const camera = ctx.value.cameraManager.camera as THREE.PerspectiveCamera
    const maxDim = Math.max(size.x, size.y, size.z, 0.1)
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const distance = Math.max(1.5, (maxDim / (2 * Math.tan(fov / 2))) * 1.4)
    const dir = new THREE.Vector3(1, 0.6, 1.2).normalize()
    camera.position.copy(center.clone().addScaledVector(dir, distance))
    if (ctx.value.orbit) {
      ctx.value.orbit.controls.target.copy(center)
      ctx.value.orbit.controls.update()
    }
  }

  const fitToObject = (obj: THREE.Object3D) => {
    if (!ctx.value) return
    const box = new THREE.Box3().setFromObject(obj)
    if (box.isEmpty()) return
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const camera = ctx.value.cameraManager.camera as THREE.PerspectiveCamera
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const distance = Math.max(2, (maxDim / (2 * Math.tan(fov / 2))) * 1.6)
    const dir = new THREE.Vector3(1, 0.8, 1).normalize()

    camera.position.copy(center.clone().addScaledVector(dir, distance))
    if (ctx.value.orbit) {
      ctx.value.orbit.controls.target.copy(center)
      ctx.value.orbit.controls.update()
    }
  }

  const dimObject = (obj: THREE.Object3D, opacity: number) => {
    obj.traverse(node => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh || !mesh.material) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach(mat => {
        if (!drillMaterialState.has(mat)) {
          drillMaterialState.set(mat, { transparent: mat.transparent, opacity: mat.opacity })
        }
        mat.transparent = true
        mat.opacity = opacity
        mat.needsUpdate = true
      })
    })
  }

  const clearDrillVisual = () => {
    if (!ctx.value) return
    collectEditableObjects().forEach(obj => {
      obj.traverse(node => {
        const mesh = node as THREE.Mesh
        if (!mesh.isMesh || !mesh.material) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach(mat => {
          const state = drillMaterialState.get(mat)
          if (!state) return
          mat.transparent = state.transparent
          mat.opacity = state.opacity
          mat.needsUpdate = true
        })
      })
    })
  }

  const enterDrill = (obj: THREE.Object3D): boolean => {
    if (!ctx.value) return false
    if (obj.userData?.focusEnabled !== true) return false

    const camera = ctx.value.cameraManager.camera
    const target = ctx.value.orbit
      ? ctx.value.orbit.controls.target.clone()
      : new THREE.Vector3(0, 0, 0)
    drillCameraSnapshot = {
      position: camera.position.clone(),
      target
    }

    drillActive.value = true
    drillTargetId.value = obj.uuid
    drillTargetName.value = obj.name || obj.type

    collectEditableObjects().forEach(root => {
      if (root.uuid === obj.uuid) dimObject(root, 1)
      else dimObject(root, 0.12)
    })

    select(obj)
    ctx.value.transform.attach(null)
    fitToObject(obj)
    return true
  }

  const exitDrill = () => {
    if (!ctx.value) return
    drillActive.value = false
    drillTargetId.value = null
    drillTargetName.value = ''
    clearDrillVisual()
    if (drillCameraSnapshot) {
      ctx.value.cameraManager.camera.position.copy(drillCameraSnapshot.position)
      if (ctx.value.orbit) {
        ctx.value.orbit.controls.target.copy(drillCameraSnapshot.target)
        ctx.value.orbit.controls.update()
      }
      drillCameraSnapshot = null
    }
    const selected = getSelectedObject()
    if (selected) {
      ctx.value.transform.attach(selected)
      applyToolMode()
    }
  }

  const drillPick = (event: PointerEvent) => {
    if (!ctx.value) return
    const canvas = ctx.value.renderer.domElement
    const selectableObjects = collectEditableObjects()
    const result = ctx.value.selection.pick(event.clientX, event.clientY, canvas, selectableObjects)
    if (!result.object) return
    const target = findSelectableRoot(result.object)
    const ok = enterDrill(target)
    if (!ok) {
      notice.value = { message: '该对象未开启钻取：请在右侧属性面板勾选“允许钻取”' }
      setTimeout(() => { notice.value = null }, 2500)
    }
  }

  const createImportedPartObject = async (spec: PartSpec): Promise<THREE.Object3D> => {
    const group = new THREE.Group()
    group.name = spec.name
    group.userData.partId = spec.id
    group.userData.partName = spec.name
    group.userData.sourceResourceId = spec.resourceId
    group.userData.source = {
      type: 'gltf',
      resourceId: spec.resourceId
    }
    group.userData.focusEnabled = spec.focusEnabled ?? false

    if (spec.resourceId) {
      const model = await loadModelFromResource(spec.resourceId)
      group.add(model)
      const bbox = new THREE.Box3().setFromObject(group)
      if (!bbox.isEmpty()) {
        group.position.y -= bbox.min.y
      }
    }

    return group
  }

  const createPartObjectFromSpec = async (spec: PartSpec): Promise<THREE.Object3D> => {
    if (spec.source === 'imported') {
      return createImportedPartObject(spec)
    }
    return createBuiltinPartMesh(spec)
  }

  /** 隐藏机柜中的柜门 mesh，保留柜体，便于直接查看内部排布 */
  const hideCabinetDoors = (cabinetObj: THREE.Object3D) => {
    const doorNames = ['door', '门', 'Door', 'cabinet_door', 'cabinet-door', 'front_door']
    cabinetObj.traverse(node => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh) return
      const name = (mesh.name || '').toLowerCase()
      const isDoor =
        mesh.userData?.isDoor === true ||
        doorNames.some(k => name.includes(k.toLowerCase())) ||
        /door|门/.test(mesh.name || '')
      if (isDoor) mesh.visible = false
    })
  }

  const buildLayoutScene = async () => {
    if (!ctx.value) return
    const previousMode = mode.value
    const removable = ctx.value.scene.children.filter(o => !o.userData?.nonSelectable)
    removable.forEach(o => ctx.value!.scene.remove(o))

    if (cabinetComponentId.value) {
      const cabinet = componentStore.get(cabinetComponentId.value)
      if (cabinet) {
        const cabinetSpec: PartSpec = {
          id: cabinet.id,
          name: cabinet.name,
          icon: 'mdi:archive-outline',
          color: '#607d8b',
          category: 'structure',
          kind: 'cabinet',
          size: cabinet.size,
          footprintMm: getCabinetPanelSize(cabinet),
          source: 'imported',
          resourceId: cabinet.resourceId,
          focusEnabled: false
        }
        try {
          const cabinetObj = await createPartObjectFromSpec(cabinetSpec)
          cabinetObj.name = cabinet.name
          cabinetObj.userData.focusEnabled = false
          cabinetObj.userData.nonSelectable = false
          ctx.value.scene.add(cabinetObj)
        } catch {
          // Keep editing flow working when cabinet model resource is missing.
        }
      }
    }

    const cabinet = cabinetComponentId.value ? componentStore.get(cabinetComponentId.value) : undefined
    const panelAxis = cabinet?.cabinetMeta?.panel?.axis ?? 'xy'
    const [panelX, panelY, panelZ] = getPanelOrigin3d(cabinet)
    const [boardW, boardH] = boardSizeMm.value

    for (const item of layoutItems.value) {
      const spec = getPartSpec(item.componentId)
      if (!spec) continue
      try {
        const obj = await createPartObjectFromSpec(spec)
        obj.name = item.name
        const xCenterMm = item.xMm + item.widthMm / 2
        const yCenterMm = item.yMm + item.heightMm / 2

        if (panelAxis === 'xy') {
          obj.rotation.set(0, 0, THREE.MathUtils.degToRad(item.rotationDeg))
          obj.position.x = panelX + (xCenterMm - boardW / 2) * MM_TO_M
          obj.position.y = panelY + (boardH / 2 - yCenterMm) * MM_TO_M
          const bbox = new THREE.Box3().setFromObject(obj)
          obj.position.z = !bbox.isEmpty() ? panelZ - bbox.min.z : panelZ + (spec.size?.[2] ?? 0.1) / 2
        } else {
          obj.rotation.set(0, THREE.MathUtils.degToRad(item.rotationDeg), 0)
          obj.position.x = panelX + (xCenterMm - boardW / 2) * MM_TO_M
          obj.position.z = panelY + (yCenterMm - boardH / 2) * MM_TO_M
        }

        obj.userData.layoutItemId = item.id
        obj.userData.focusEnabled = item.focusEnabled === true
        obj.userData.componentId = item.componentId
        ctx.value.scene.add(obj)
      } catch {
        // Keep batch build tolerant to per-component loading errors.
      }
    }

    refreshTree()
    runCollisionCheck()
    if (previousMode === '3d') {
      select(null)
    }
  }

  const setMode = async (nextMode: AssetEditorMode) => {
    if (mode.value === nextMode) return
    if (drillActive.value) exitDrill()
    mode.value = nextMode
    if (nextMode === '3d') {
      await buildLayoutScene()
      select(null)
      applyToolMode()
      return
    }
    select(null)
    applyToolMode()
  }

  const spawn = async (partId: string, position?: THREE.Vector3) => {
    void position
    if (!ctx.value || drillActive.value) return
    if (mode.value === '3d') {
      notice.value = { message: '当前为 3D 派生预览，只读模式下请回到 2D 排布添加组件。' }
      setTimeout(() => { notice.value = null }, 2200)
      return
    }
    addLayoutItem(partId)
  }

  const setFocusEnabled = (uuid: string, enabled: boolean) => {
    if (!ctx.value) return
    const obj = ctx.value.scene.getObjectByProperty('uuid', uuid)
    if (!obj) return
    obj.userData.focusEnabled = enabled
    const layoutId = obj.userData?.layoutItemId as string | undefined
    if (layoutId) {
      updateLayoutItem(layoutId, { focusEnabled: enabled })
    }
    hasUnsavedChanges.value = true
  }

  const select = (obj: THREE.Object3D | null) => {
    if (!ctx.value) return
    if (obj) {
      ctx.value.selection.select(obj)
      if (!drillActive.value) ctx.value.transform.attach(obj)
    } else {
      ctx.value.selection.clear()
      ctx.value.transform.attach(null)
    }
    applyToolMode()
  }

  const deleteSelection = () => {
    if (!ctx.value || drillActive.value || mode.value === '3d') return
    const selection = ctx.value.selection.getSelection()
    selection.forEach(obj => {
      if (!obj.userData?.nonSelectable) {
        ctx.value!.actions.removeObject(obj)
      }
    })
    select(null)
  }

  const setTool = (toolMode: TransformMode) => {
    if (drillActive.value || mode.value === '3d') return
    currentTool.value = toolMode
    applyToolMode()
  }

  const applyToolMode = () => {
    if (!ctx.value) return
    if (drillActive.value || mode.value === '3d') {
      ctx.value.transform.attach(null)
      return
    }
    ctx.value.transform.setMode(currentTool.value)
  }

  const undo = () => {
    if (drillActive.value || mode.value === '3d') return
    ctx.value?.history.undo()
    hasUnsavedChanges.value = true
    runCollisionCheck()
  }

  const redo = () => {
    if (drillActive.value || mode.value === '3d') return
    ctx.value?.history.redo()
    hasUnsavedChanges.value = true
    runCollisionCheck()
  }

  const withStrippedResourceChildren = <T>(fn: () => T): T => {
    if (!ctx.value) return fn()
    const backups: Array<{ node: THREE.Object3D; children: THREE.Object3D[] }> = []
    ctx.value.scene.traverse(node => {
      if (!node.userData?.sourceResourceId) return
      if (node.children.length === 0) return
      backups.push({ node, children: [...node.children] })
      node.clear()
    })

    try {
      return fn()
    } finally {
      backups.forEach(({ node, children }) => {
        children.forEach(child => node.add(child))
      })
    }
  }

  const serializeForSave = () => {
    if (!ctx.value) return null
    return withStrippedResourceChildren(() => ctx.value!.serializeScene())
  }

  const saveAsset = async (name?: string, existingId?: string): Promise<AssetRecord | null> => {
    await buildLayoutScene()
    runCollisionCheck()
    const sceneData = serializeForSave()
    if (!sceneData) return null

    const now = Date.now()
    const id = existingId || currentAssetId.value || assetStore.generateId()
    const saveName = name || currentAssetName.value || '未命名资产'
    const previous = assetStore.get(id)
    const layoutData: Layout2DData = {
      board: {
        widthMm: boardSizeMm.value[0],
        heightMm: boardSizeMm.value[1],
        gridMm: 50,
        origin: 'top-left'
      },
      items: layoutItems.value
    }

    const record: AssetRecord = {
      id,
      name: saveName,
      createdAt: existingId ? (previous?.createdAt ?? now) : (previous?.createdAt ?? now),
      updatedAt: now,
      storageVersion: 1,
      sourceResourceId: previous?.sourceResourceId,
      thumbnailResourceId: previous?.thumbnailResourceId,
      stats: previous?.stats,
      importProfile: previous?.importProfile,
      cabinetComponentId: cabinetComponentId.value ?? previous?.cabinetComponentId,
      layout2d: layoutData,
      lastUsedMode: mode.value,
      sceneData
    }
    assetStore.save(record)
    currentAssetId.value = id
    currentAssetName.value = saveName
    hasUnsavedChanges.value = false
    return record
  }

  const applySchemaToObject = (obj: THREE.Object3D, schema: any) => {
    obj.name = schema.name || ''
    obj.visible = schema.visible ?? true
    obj.position.fromArray(schema.transform.position)
    obj.rotation.set(...(schema.transform.rotation as [number, number, number]))
    obj.scale.fromArray(schema.transform.scale)
    if (schema.userData) obj.userData = { ...schema.userData }
  }

  const rebuildObject = async (schema: ObjectSchema | any): Promise<THREE.Object3D> => {
    if (schema.userData?.sourceResourceId) {
      const group = new THREE.Group()
      applySchemaToObject(group, schema)
      try {
        const model = await loadModelFromResource(schema.userData.sourceResourceId)
        group.add(model)
      } catch {
        // 资源缺失时保留占位 Group，保证场景可继续编辑
      }
      return group
    }

    if (schema.type === 'mesh' && schema.geometry) {
      const geo = rebuildGeometry(schema.geometry)
      const mat = rebuildMaterial(schema.material)
      const mesh = new THREE.Mesh(geo, mat)
      applySchemaToObject(mesh, schema)
      mesh.castShadow = schema.castShadow ?? false
      mesh.receiveShadow = schema.receiveShadow ?? false
      if (schema.children) {
        for (const c of schema.children) mesh.add(await rebuildObject(c))
      }
      return mesh
    }

    const group = new THREE.Group()
    applySchemaToObject(group, schema)
    if (schema.children) {
      for (const c of schema.children) group.add(await rebuildObject(c))
    }
    return group
  }

  const loadAsset = async (assetId: string) => {
    if (!ctx.value) return
    const record = assetStore.get(assetId)
    if (!record) return

    clearScene()
    currentAssetId.value = assetId
    currentAssetName.value = record.name

    if (record.layout2d) {
      setCabinetComponent(record.cabinetComponentId ?? null)
      const board = record.layout2d.board
      boardSizeMm.value = [
        Math.max(1, board.widthMm || DEFAULT_BOARD_MM[0]),
        Math.max(1, board.heightMm || DEFAULT_BOARD_MM[1])
      ]
      layoutItems.value = [...record.layout2d.items]
      selectedLayoutItemId.value = null
      mode.value = record.lastUsedMode ?? '2d'
      await buildLayoutScene()
    } else {
      mode.value = '3d'
      layoutItems.value = []
      selectedLayoutItemId.value = null
      setCabinetComponent(record.cabinetComponentId ?? null)
      for (const objSchema of record.sceneData.objects) {
        const obj = await rebuildObject(objSchema)
        ctx.value.scene.add(obj)
      }
      notice.value = { message: '该资产尚未配置 2D 布局，当前以 3D 兼容模式打开。' }
      setTimeout(() => { notice.value = null }, 2600)
      refreshTree()
      runCollisionCheck()
    }

    hasUnsavedChanges.value = false
  }

  const clearScene = () => {
    if (!ctx.value) return
    const removable = ctx.value.scene.children.filter(o => !o.userData?.nonSelectable)
    removable.forEach(o => ctx.value!.scene.remove(o))
    select(null)
    hasUnsavedChanges.value = false
    collisionIssues.value = []
    clearCollisionHighlight()
    exitDrill()
    refreshTree()
  }

  const createNewWithCabinet = async (componentId: string) => {
    clearScene()
    currentAssetId.value = null
    currentAssetName.value = ''
    layoutItems.value = []
    selectedLayoutItemId.value = null
    setCabinetComponent(componentId)
    mode.value = '2d'
    await buildLayoutScene()
    hasUnsavedChanges.value = false
  }

  const findSelectableRoot = (object: THREE.Object3D): THREE.Object3D => {
    let current: THREE.Object3D = object
    while (current.parent && current.parent.type !== 'Scene') {
      current = current.parent
    }
    return current
  }

  const pick = (event: PointerEvent) => {
    if (!ctx.value) return
    if ((ctx.value.transform.controls as any).dragging) return

    const canvas = ctx.value.renderer.domElement
    const selectableObjects = ctx.value.scene.children.filter(o => !o.userData?.nonSelectable)
    const result = ctx.value.selection.pick(event.clientX, event.clientY, canvas, selectableObjects)

    if (result.object && !result.object.userData?.nonSelectable) {
      const target = findSelectableRoot(result.object)
      select(target)
    } else if (!event.ctrlKey && !event.metaKey) {
      select(null)
    }
  }

  const getSelectedObject = (): THREE.Object3D | null => {
    if (!ctx.value) return null
    const sel = ctx.value.selection.getSelection()
    return sel.length > 0 ? sel[0] : null
  }

  const refreshTree = () => {
    if (!ctx.value) return
    sceneTree.value = ctx.value.scene.children
      .filter(o => !o.userData?.nonSelectable)
      .map(o => buildTreeNode(o))
  }

  const selectById = (uuid: string) => {
    if (!ctx.value) return
    const obj = ctx.value.scene.getObjectByProperty('uuid', uuid)
    if (obj) select(obj)
  }

  const focusObjectById = (uuid: string) => {
    if (!ctx.value) return
    const obj = ctx.value.scene.getObjectByProperty('uuid', uuid)
    if (!obj) return
    select(obj)
    fitToObject(obj)
  }

  const toggleVisibility = (uuid: string) => {
    if (!ctx.value) return
    const obj = ctx.value.scene.getObjectByProperty('uuid', uuid)
    if (obj) {
      ctx.value.sceneGraph.setVisible(obj, !obj.visible)
      refreshTree()
    }
  }

  const dispose = () => {
    if (collisionTimer) clearTimeout(collisionTimer)
    clearCollisionHighlight()
    clearDrillVisual()
    ctx.value?.dispose()
    ctx.value = null
  }

  const api = {
    ctx,
    mode,
    currentTool,
    selectedIds,
    sceneTree,
    currentAssetId,
    currentAssetName,
    cabinetComponentId,
    boardSizeMm,
    layoutItems,
    selectedLayoutItemId,
    selectedLayoutItem,
    hasUnsavedChanges,
    partSpecs,
    collisionIssues,
    drillActive,
    drillTargetId,
    drillTargetName,
    notice,
    init,
    setMode,
    setCabinetComponent,
    spawn,
    addLayoutItem,
    updateLayoutItem,
    removeLayoutItem,
    selectLayoutItem,
    buildLayoutScene,
    fitCameraToScene,
    select,
    deleteSelection,
    setTool,
    undo,
    redo,
    saveAsset,
    loadAsset,
    createNewWithCabinet,
    clearScene,
    pick,
    drillPick,
    exitDrill,
    runCollisionCheck,
    getSelectedObject,
    selectById,
    focusObjectById,
    toggleVisibility,
    setFocusEnabled,
    sceneEnv,
    updateSceneEnv,
    refreshImportedParts,
    dispose
  }

  provide(EDITOR_KEY, api)
  return api
}

export type AssetEditorAPI = ReturnType<typeof createAssetEditor>

export function useAssetEditor(): AssetEditorAPI {
  const api = inject<AssetEditorAPI>(EDITOR_KEY)
  if (!api) throw new Error('useAssetEditor must be used within createAssetEditor provider')
  return api
}
