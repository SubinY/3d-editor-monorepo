import { CoreContext, EditorEvents, createBox, createStandardMaterial } from '@3d-editor/engine'
import { createSnapPlugin, SnapSystem } from '@3d-editor/extensions'
import * as THREE from 'three'
import { factoryPreset } from '../preset/factory-preset'
import type { FactoryPresetState } from '../preset/types'
import type { FactoryRuntime, FactoryRuntimeOptions, FactoryComponentOptions, ToolMode } from './types'

export function createFactoryRuntime(options?: FactoryRuntimeOptions): FactoryRuntime {
  let ctx: CoreContext | null = null
  let presetState: FactoryPresetState | null = null
  const floorSize = {
    width: options?.initialFloorSize?.width ?? 140,
    depth: options?.initialFloorSize?.depth ?? 50
  }

  const registry = new Map<string, FactoryComponentOptions>()
  const snap = new SnapSystem({
    gridSize: options?.snap?.gridSize ?? 1
  })
  const tubes: THREE.Mesh[] = []
  let currentTool: ToolMode = 'translate'

  const applyAxisVisibility = () => {
    if (!ctx) return
    const controls = ctx.transform.controls as {
      showX?: boolean
      showY?: boolean
      showZ?: boolean
    }
    if (!controls) return
    if (currentTool === 'translate') {
      controls.showX = true
      controls.showY = false
      controls.showZ = true
    } else if (currentTool === 'rotate') {
      controls.showX = false
      controls.showY = true
      controls.showZ = false
    } else {
      controls.showX = true
      controls.showY = true
      controls.showZ = true
    }
  }

  const setNonSelectable = (obj: THREE.Object3D, preserveRaycast = false) => {
    obj.traverse(child => {
      child.userData = child.userData ?? {}
      child.userData.nonSelectable = true
      if (!preserveRaycast) {
        child.raycast = () => {}
      }
    })
  }

  const clampObjectToFloor = (obj: THREE.Object3D) => {
    if (presetState) {
      presetState.clampToFloor(obj)
    }
  }

  const defaultBox = () => {
    const g = createBox(4, 3, 4)
    const m = createStandardMaterial('#4da3ff')
    m.metalness = 0.3
    m.roughness = 0.45
    const mesh = new THREE.Mesh(g, m)
    mesh.position.y = 1.5
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  const createTubeToNearest = (lineObj: THREE.Object3D) => {
    if (!ctx) return
    const others = ctx.scene.children.filter(
      o => o !== lineObj && !o.userData?.nonSelectable && o.type === 'Group'
    )
    if (others.length < 2) return
    const distances = others
      .map(o => ({
        obj: o,
        d: o.position.distanceTo(lineObj.position)
      }))
      .sort((a, b) => a.d - b.d)
    const a = distances[0].obj
    const b = distances[1].obj
    const curve = new THREE.CatmullRomCurve3([
      a.position.clone(),
      lineObj.position.clone(),
      b.position.clone()
    ])
    const tube = new THREE.TubeGeometry(curve, 20, 0.3, 8, false)
    const mat = new THREE.MeshStandardMaterial({
      color: '#2de3ff',
      emissive: '#1b4b7a',
      transparent: true,
      opacity: 0.9
    })
    const mesh = new THREE.Mesh(tube, mat)
    mesh.userData.nonSelectable = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    ctx.scene.add(mesh)
    tubes.push(mesh)
  }

  const init = async (container: HTMLElement) => {
    ctx = new CoreContext({
      container,
      rendererOptions: { antialias: true, alpha: true },
      plugins: [
        createSnapPlugin({
          gridSize: options?.snap?.gridSize ?? 1,
          angleStep: options?.snap?.angleStep ?? THREE.MathUtils.degToRad(15)
        })
      ]
    })

    const applied = await ctx.applyPreset(factoryPreset, {
      floor: {
        width: floorSize.width,
        depth: floorSize.depth,
        showFrame: true,
        ...options?.presetOptions?.floor
      },
      lighting: {
        ambientColor: '#bbdefb',
        ambientIntensity: 0.4,
        mainIntensity: 0.8,
        mainPosition: [0, 100, 0],
        ...options?.presetOptions?.lighting
      },
      camera: {
        fov: 40,
        position: [0, 60, 100],
        target: [0, 0, 0],
        ...options?.presetOptions?.camera
      },
      background: {
        gradient: ['160deg', '#1a0a2e 0%', '#16213e 40%', '#0f3460 100%'],
        enableNoise: true,
        ...options?.presetOptions?.background
      },
      renderer: options?.presetOptions?.renderer
    })

    presetState = applied.state as FactoryPresetState

    ctx.axisHelper.setEnabled(false)
    ctx.scene.add(ctx.transform.controls)
    setNonSelectable(ctx.transform.controls, true)

    ctx.transform.setMode(currentTool)
    applyAxisVisibility()

    const rawControls = ctx.transform.controls as {
      setDragTo?: (drag: boolean) => void
      setSize?: (size: number) => void
      size?: number
    }
    rawControls.setDragTo?.(true)
    if (rawControls.setSize) {
      rawControls.setSize(1.4)
    } else if (typeof rawControls.size === 'number') {
      rawControls.size = 1.4
    }

    ctx.eventBus.on(EditorEvents.OBJECT_TRANSFORMED, payload => {
      if (!ctx || !(payload as any)?.id) return
      const id = (payload as any).id as string
      const obj = ctx.scene.getObjectByProperty('uuid', id) as THREE.Object3D | null
      if (obj && presetState) {
        presetState.clampToFloor(obj)
      }
    })
  }

  const resizeFloor = async (deltaX: number, deltaZ: number) => {
    if (!ctx || !presetState) return
    const newSize = await presetState.resizeFloor({ deltaX, deltaZ })
    floorSize.width = newSize.width
    floorSize.depth = newSize.depth
    options?.onFloorSizeChange?.(floorSize)
    presetState.updateLightShadowBounds()
    ctx.scene.children
      .filter(obj => !obj.userData?.nonSelectable)
      .forEach(obj => clampObjectToFloor(obj))
  }

  const registerComponent = (id: string, opts: FactoryComponentOptions) => {
    registry.set(id, opts)
  }

  const select = (obj: THREE.Object3D | null) => {
    if (!ctx) return
    if (obj) {
      ctx.selection.select(obj)
      ctx.transform.attach(obj)
    } else {
      ctx.selection.clear()
      ctx.transform.attach(null)
    }
    applyAxisVisibility()
  }

  const spawn = (id: string, position?: THREE.Vector3) => {
    if (!ctx) return
    const spec = registry.get(id)
    const creator = spec?.createMesh
    const obj = creator ? creator() : defaultBox()
    const pos = snap.snapPosition(position ?? new THREE.Vector3())
    obj.position.set(pos.x, 0, pos.z)
    clampObjectToFloor(obj)
    ctx.actions.addObject(obj)
    select(obj)
    if (id === 'line') {
      createTubeToNearest(obj)
    }
  }

  const reset = () => {
    if (!ctx) return
    const keep = ctx.scene.children.filter(o => o.userData?.nonSelectable)
    ctx.scene.clear()
    keep.forEach(o => ctx!.scene.add(o))
    ctx.scene.add(ctx.transform.controls)
    tubes.length = 0
    select(null)
  }

  const save = () => {
    if (!ctx) return null
    return ctx.serializeScene({
      customData: { floorSize: { width: floorSize.width, depth: floorSize.depth } }
    })
  }

  const undo = () => ctx?.history.undo()
  const redo = () => ctx?.history.redo()

  const setTool = (mode: ToolMode) => {
    if (!ctx) return
    currentTool = mode
    ctx.transform.setMode(mode)
    applyAxisVisibility()
  }

  const removeSelection = () => {
    if (!ctx) return
    const selection = ctx.selection.getSelection()
    selection.forEach(obj => {
      if (obj.userData?.nonSelectable) return
      ctx?.actions.removeObject(obj)
    })
    select(null)
  }

  const getSelection = () => {
    if (!ctx) return []
    return ctx.selection.getSelection()
  }

  const dispose = () => {
    ctx?.dispose()
    ctx = null
    presetState = null
    tubes.length = 0
  }

  return {
    getContext: () => ctx,
    getFloorSize: () => floorSize,
    init,
    resizeFloor,
    registerComponent,
    spawn,
    reset,
    save,
    undo,
    redo,
    select,
    setTool,
    removeSelection,
    getSelection,
    dispose
  }
}

