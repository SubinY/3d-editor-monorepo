import type { CoreContext } from '@3d-editor/editor'
import * as THREE from 'three'
import type { FactoryPresetOptions } from '../preset/types'

export type ToolMode = 'translate' | 'rotate' | 'scale'

export interface FactoryComponentOptions {
  createMesh: () => THREE.Object3D
}

export interface FactoryRuntimeOptions {
  initialFloorSize?: { width: number; depth: number }
  presetOptions?: FactoryPresetOptions
  snap?: { gridSize?: number; angleStep?: number }
  onFloorSizeChange?: (size: { width: number; depth: number }) => void
}

export interface FactoryRuntime {
  getContext: () => CoreContext | null
  getFloorSize: () => { width: number; depth: number }
  init: (container: HTMLElement) => Promise<void>
  resizeFloor: (deltaX: number, deltaZ: number) => Promise<void>
  registerComponent: (id: string, opts: FactoryComponentOptions) => void
  spawn: (id: string, position?: THREE.Vector3) => void
  reset: () => void
  save: () => any
  undo: () => void
  redo: () => void
  select: (obj: THREE.Object3D | null) => void
  setTool: (mode: ToolMode) => void
  removeSelection: () => void
  getSelection: () => THREE.Object3D[]
  dispose: () => void
}

