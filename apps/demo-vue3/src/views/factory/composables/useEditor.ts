import type { CoreContext } from '@3d-editor/engine'
import { createFactoryRuntime, type FactoryComponentOptions, type ToolMode } from '@3d-editor/presets'
import * as THREE from 'three'
import { inject, provide, reactive, ref } from 'vue'
import type { RegisterComponentOptions } from '../types'

const key = Symbol('editor')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEditor(): any {
  const ctx = ref<CoreContext | null>(null)
  const floorSize = reactive({ width: 140, depth: 50 })

  const runtime = createFactoryRuntime({
    initialFloorSize: { width: floorSize.width, depth: floorSize.depth },
    onFloorSizeChange: size => {
      floorSize.width = size.width
      floorSize.depth = size.depth
    }
  })

  const init = async (container: HTMLElement) => {
    await runtime.init(container)
    ctx.value = runtime.getContext()
  }

  const resizeFloor = (deltaX: number, deltaZ: number) => runtime.resizeFloor(deltaX, deltaZ)
  const registerComponent = (id: string, opts: RegisterComponentOptions) =>
    runtime.registerComponent(id, opts as FactoryComponentOptions)
  const spawn = (id: string, position?: THREE.Vector3) => runtime.spawn(id, position)
  const reset = () => runtime.reset()
  const save = () => runtime.save()
  const undo = () => runtime.undo()
  const redo = () => runtime.redo()
  const select = (obj: THREE.Object3D | null) => runtime.select(obj)
  const setTool = (mode: ToolMode) => runtime.setTool(mode)
  const removeSelection = () => runtime.removeSelection()
  const getSelection = () => runtime.getSelection()

  const api = {
    ctx,
    floorSize,
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
    getSelection
  }

  provide(key, api)
  return api
}

export function useEditor() {
  return inject(key)
}
