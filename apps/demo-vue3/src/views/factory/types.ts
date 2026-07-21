import type { Ref } from 'vue'
import type * as THREE from 'three'

export type PanelType = 'production' | 'operation' | 'environment'

export interface PanelState {
  id: PanelType
  title: string
  icon: string
  visible: Ref<boolean>
  position: Ref<{ x: number; y: number }>
  size: Ref<{ w: number; h: number }>
  zIndex: Ref<number>
}

export interface ComponentSpec {
  id: string
  name: string
  icon: string
  color: string
}

export interface RegisterComponentOptions {
  createMesh: () => THREE.Object3D
}

export interface EditorAPI {
  ctx: Ref<THREE.Object3D | null>
}
