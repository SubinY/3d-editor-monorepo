import { ref, shallowRef, inject, provide } from 'vue'
import * as THREE from 'three'
import {
  CoreContext,
  createBox,
  createStandardMaterial,
  EditorEvents,
  type SceneSchema
} from '@3d-editor/engine'
import { factoryPreset, type FactoryPresetState } from '@3d-editor/presets'
import { DEFAULT_FACTORY_ENV } from '@/config/scene-env'
import { createSnapPlugin } from '@3d-editor/extensions'
import { assetStore } from '@/stores/asset-store'
import { sceneStore, type SceneRecord } from '@/stores/scene-store'
import { loadModelFromResource } from '@/services/model-resource-service'
import type { TransformMode, TreeNodeData } from '../types'

const EDITOR_KEY = Symbol('scene-editor')

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

export function createSceneEditor() {
  const ctx = shallowRef<CoreContext | null>(null)
  const presetState = shallowRef<FactoryPresetState | null>(null)
  const currentTool = ref<TransformMode>('translate')
  const selectedIds = ref<string[]>([])
  const sceneTree = ref<TreeNodeData[]>([])
  const currentSceneId = ref<string | null>(null)

  const floorWidth = ref(60)
  const floorDepth = ref(30)
  const sceneName = ref('')
  const commInfo = ref({ protocol: '', address: '', port: '' })

  const sceneEnv = ref({
    backgroundType: 'color' as 'color' | 'image' | 'panorama',
    backgroundColor: DEFAULT_FACTORY_ENV.background.color,
    backgroundImageUrl: null as string | null,
    backgroundPanoramaUrl: null as string | null,
    ambientIntensity: DEFAULT_FACTORY_ENV.lighting.ambientIntensity,
    mainIntensity: DEFAULT_FACTORY_ENV.lighting.mainIntensity,
    environmentIntensity: DEFAULT_FACTORY_ENV.environment.intensity
  })

  const drillActive = ref(false)
  const drillTargetId = ref<string | null>(null)
  const drillTargetName = ref('')
  const notice = ref<{ message: string } | null>(null)
  const drillMaterialState = new WeakMap<THREE.Material, { transparent: boolean; opacity: number }>()
  let drillCameraSnapshot: { position: THREE.Vector3; target: THREE.Vector3 } | null = null

  const init = async (container: HTMLElement) => {
    const context = new CoreContext({
      container,
      rendererOptions: { antialias: true, alpha: true },
      plugins: [
        createSnapPlugin({ gridSize: 1, angleStep: THREE.MathUtils.degToRad(15) })
      ]
    })

    const applied = await context.applyPreset(factoryPreset, {
      floor: {
        width: floorWidth.value,
        depth: floorDepth.value,
        showFrame: true
      },
      ...DEFAULT_FACTORY_ENV,
      camera: {
        fov: 40,
        position: [0, 60, 100],
        target: [0, 0, 0]
      }
    })

    presetState.value = applied.state as FactoryPresetState

    context.axisHelper.setEnabled(false)
    context.scene.add(context.transform.controls)
    context.transform.controls.userData.nonSelectable = true
    context.transform.controls.traverse((child: THREE.Object3D) => {
      child.userData.nonSelectable = true
    })

    context.transform.setMode(currentTool.value)
    applyAxisVisibility()

    const rawControls = context.transform.controls as any
    if (rawControls.setSize) rawControls.setSize(1.4)
    else if (typeof rawControls.size === 'number') rawControls.size = 1.4

    context.selection.onSelectionChanged = selection => {
      selectedIds.value = selection.map(o => o.uuid)
    }

    context.eventBus.on(EditorEvents.OBJECT_ADDED, () => refreshTree())
    context.eventBus.on(EditorEvents.OBJECT_REMOVED, () => refreshTree())
    context.eventBus.on(EditorEvents.OBJECT_TRANSFORMED, payload => {
      if (!context || !(payload as any)?.id) return
      const id = (payload as any).id as string
      const obj = context.scene.getObjectByProperty('uuid', id)
      if (obj && presetState.value) {
        presetState.value.clampToFloor(obj)
      }
    })

    ctx.value = context
    refreshTree()
  }

  const updateSceneEnv = async (patch?: Partial<typeof sceneEnv.value>) => {
    if (!ctx.value) return
    if (patch) {
      sceneEnv.value = { ...sceneEnv.value, ...patch }
    }
    const env = sceneEnv.value
    const bg: { type: 'color' | 'image' | 'panorama'; color?: string; imageUrl?: string; panoramaUrl?: string } = {
      type: env.backgroundType
    }
    if (env.backgroundType === 'color') bg.color = env.backgroundColor
    else if (env.backgroundType === 'image' && env.backgroundImageUrl) bg.imageUrl = env.backgroundImageUrl
    else if (env.backgroundType === 'panorama') {
      // 未上传时使用默认 HDR，避免选中全景图却显示深蓝 fallback
      bg.panoramaUrl = env.backgroundPanoramaUrl || DEFAULT_FACTORY_ENV.environment.url
    }

    const opts = {
      floor: { width: floorWidth.value, depth: floorDepth.value, showFrame: true },
      background: bg,
      lighting: {
        ambientColor: '#ffffff',
        ambientIntensity: env.ambientIntensity,
        mainColor: '#ffffff',
        mainIntensity: env.mainIntensity,
        mainPosition: [0, 100, 0] as [number, number, number]
      },
      environment: env.backgroundType === 'color'
        ? { url: DEFAULT_FACTORY_ENV.environment.url, intensity: env.environmentIntensity }
        : undefined,
      camera: { fov: 40, position: [0, 60, 100], target: [0, 0, 0] }
    }
    const applied = await ctx.value.applyPreset(factoryPreset, opts)
    presetState.value = applied.state as FactoryPresetState
  }

  const collectEditableObjects = (): THREE.Object3D[] => {
    if (!ctx.value) return []
    return ctx.value.scene.children.filter(obj => !obj.userData?.nonSelectable)
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
    const result = ctx.value.selection.pick(event.clientX, event.clientY, canvas, collectEditableObjects())
    if (!result.object) return
    const target = findSelectableRoot(result.object)
    const ok = enterDrill(target)
    if (!ok) {
      notice.value = { message: '该对象未开启钻取：请在右侧面板勾选“允许钻取查看”' }
      setTimeout(() => { notice.value = null }, 2500)
    }
  }

  const setFocusEnabled = (uuid: string, enabled: boolean) => {
    if (!ctx.value) return
    const obj = ctx.value.scene.getObjectByProperty('uuid', uuid)
    if (!obj) return
    obj.userData.focusEnabled = enabled
  }

  const applyAxisVisibility = () => {
    if (!ctx.value) return
    const controls = ctx.value.transform.controls as any
    if (!controls) return
    if (currentTool.value === 'translate') {
      controls.showX = true; controls.showY = false; controls.showZ = true
    } else if (currentTool.value === 'rotate') {
      controls.showX = false; controls.showY = true; controls.showZ = false
    } else {
      controls.showX = true; controls.showY = true; controls.showZ = true
    }
  }

  const resizeFloor = async (width: number, depth: number) => {
    floorWidth.value = Math.max(10, width)
    floorDepth.value = Math.max(10, depth)
    if (presetState.value) {
      await presetState.value.resizeFloor({
        width: floorWidth.value,
        depth: floorDepth.value
      })
      presetState.value.updateLightShadowBounds()
      if (ctx.value) {
        ctx.value.scene.children
          .filter(obj => !obj.userData?.nonSelectable)
          .forEach(obj => presetState.value!.clampToFloor(obj))
      }
    }
  }

  const applySchemaToObject = (obj: THREE.Object3D, schema: any) => {
    obj.name = schema.name || ''
    obj.visible = schema.visible ?? true
    obj.position.fromArray(schema.transform.position)
    obj.rotation.set(...(schema.transform.rotation as [number, number, number]))
    obj.scale.fromArray(schema.transform.scale)
    if (schema.userData) obj.userData = { ...schema.userData }
  }

  const rebuildObject = async (schema: any): Promise<THREE.Object3D> => {
    if (schema.userData?.sourceResourceId) {
      const group = new THREE.Group()
      applySchemaToObject(group, schema)
      try {
        const model = await loadModelFromResource(schema.userData.sourceResourceId)
        group.add(model)
      } catch {
        // 资源丢失时保留占位 Group，避免场景崩溃
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

    const g = new THREE.Group()
    applySchemaToObject(g, schema)
    if (schema.children) {
      for (const c of schema.children) g.add(await rebuildObject(c))
    }
    return g
  }

  const rebuildAssetFromSchema = async (schema: SceneSchema): Promise<THREE.Group> => {
    const group = new THREE.Group()
    group.name = schema.name || '未命名资产'
    for (const objSchema of schema.objects) {
      group.add(await rebuildObject(objSchema))
    }
    return group
  }

  const spawnAsset = async (assetId: string, position?: THREE.Vector3) => {
    if (!ctx.value || drillActive.value) return
    const record = assetStore.get(assetId)
    if (!record) return

    const instance = await rebuildAssetFromSchema(record.sceneData)
    instance.userData.assetId = assetId
    instance.userData.assetName = record.name
    instance.name = record.name

    if (position) instance.position.copy(position)
    instance.position.y = 0

    if (presetState.value) presetState.value.clampToFloor(instance)
    ctx.value.actions.addObject(instance, { select: true })
    ctx.value.transform.attach(instance)
    applyToolMode()
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
    if (!ctx.value || drillActive.value) return
    const selection = ctx.value.selection.getSelection()
    selection.forEach(obj => {
      if (!obj.userData?.nonSelectable) {
        ctx.value!.actions.removeObject(obj)
      }
    })
    select(null)
  }

  const setTool = (mode: TransformMode) => {
    if (drillActive.value) return
    currentTool.value = mode
    applyToolMode()
  }

  const applyToolMode = () => {
    if (!ctx.value || drillActive.value) return
    ctx.value.transform.setMode(currentTool.value)
    applyAxisVisibility()
  }

  const undo = () => {
    if (drillActive.value) return
    ctx.value?.history.undo()
  }

  const redo = () => {
    if (drillActive.value) return
    ctx.value?.history.redo()
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

  const saveScene = (name?: string, existingId?: string): SceneRecord | null => {
    if (!ctx.value) return null
    const sceneData = withStrippedResourceChildren(() =>
      ctx.value!.serializeScene({
        customData: {
          floorSize: { width: floorWidth.value, depth: floorDepth.value },
          commInfo: commInfo.value
        }
      })
    )

    const now = Date.now()
    const saveName = name || sceneName.value || '未命名场景'
    const id = existingId || currentSceneId.value || sceneStore.generateId()
    const record: SceneRecord = {
      id,
      name: saveName,
      createdAt: existingId ? (sceneStore.get(id)?.createdAt ?? now) : now,
      updatedAt: now,
      sceneData
    }
    sceneStore.save(record)
    currentSceneId.value = id
    sceneName.value = saveName
    return record
  }

  const loadScene = async (sceneId: string) => {
    if (!ctx.value) return
    const record = sceneStore.get(sceneId)
    if (!record) return

    clearScene()
    currentSceneId.value = sceneId
    sceneName.value = record.name

    const custom = record.sceneData.customData as any
    if (custom?.floorSize) {
      await resizeFloor(custom.floorSize.width, custom.floorSize.depth)
    }
    if (custom?.commInfo) {
      commInfo.value = { ...commInfo.value, ...custom.commInfo }
    }

    for (const objSchema of record.sceneData.objects) {
      const obj = await rebuildObject(objSchema)
      ctx.value.scene.add(obj)
    }
    refreshTree()
  }

  const clearScene = () => {
    if (!ctx.value) return
    const removable = ctx.value.scene.children.filter(o => !o.userData?.nonSelectable)
    removable.forEach(o => ctx.value!.scene.remove(o))
    select(null)
    exitDrill()
    refreshTree()
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
    clearDrillVisual()
    ctx.value?.dispose()
    ctx.value = null
    presetState.value = null
  }

  const api = {
    ctx,
    presetState,
    currentTool,
    selectedIds,
    sceneTree,
    currentSceneId,
    floorWidth,
    floorDepth,
    sceneName,
    commInfo,
    sceneEnv,
    updateSceneEnv,
    drillActive,
    drillTargetId,
    drillTargetName,
    notice,
    init,
    resizeFloor,
    spawnAsset,
    select,
    deleteSelection,
    setTool,
    undo,
    redo,
    saveScene,
    loadScene,
    clearScene,
    pick,
    drillPick,
    exitDrill,
    setFocusEnabled,
    getSelectedObject,
    selectById,
    focusObjectById,
    toggleVisibility,
    dispose
  }

  provide(EDITOR_KEY, api)
  return api
}

export type SceneEditorAPI = ReturnType<typeof createSceneEditor>

export function useSceneEditor(): SceneEditorAPI {
  const api = inject<SceneEditorAPI>(EDITOR_KEY)
  if (!api) throw new Error('useSceneEditor must be used within createSceneEditor provider')
  return api
}
