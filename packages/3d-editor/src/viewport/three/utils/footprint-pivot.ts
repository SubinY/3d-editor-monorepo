/** 节点根下的 footprint 几何中心枢轴：position 仍在底面，旋转/缩放绕中心（对齐 2D layout.center）。 */
import type { Object3D } from 'three'
import type { CatalogItem } from '../../../catalog/types'
import type { TransformJSON } from '../../../document/types'

export const FOOTPRINT_PIVOT_NAME = '__footprintPivot'

export function footprintHeightMeters(item?: CatalogItem): number {
  if (!item) return 1
  return item.footprint.height ?? item.footprint.depth ?? 1
}

export function getFootprintPivot(root: Object3D): Object3D | undefined {
  return root.children.find(child => child.userData.isFootprintPivot === true)
}

export function mountFootprintPivot(
  THREE: typeof import('three'),
  root: Object3D,
  content: Object3D | undefined,
  height: number
): Object3D {
  const pivot = new THREE.Group()
  pivot.name = FOOTPRINT_PIVOT_NAME
  const pivotY = Math.max(height, 0) / 2
  pivot.userData.isFootprintPivot = true
  pivot.userData.pivotY = pivotY
  pivot.position.set(0, pivotY, 0)
  if (content) {
    content.position.y -= pivotY
    pivot.add(content)
  }
  root.add(pivot)
  return pivot
}

/** 平移时 gizmo 挂在枢轴上，把枢轴位移折回根 position，枢轴局部坐标复原为 (0, pivotY, 0)。 */
export function bakePivotTranslation(root: Object3D): void {
  const pivot = getFootprintPivot(root)
  if (!pivot) return
  const pivotY = typeof pivot.userData.pivotY === 'number' ? pivot.userData.pivotY : 0
  root.position.x += pivot.position.x
  root.position.y += pivot.position.y - pivotY
  root.position.z += pivot.position.z
  pivot.position.set(0, pivotY, 0)
}

export function applyTransformWithPivot(root: Object3D, transform: TransformJSON): void {
  const pivot = getFootprintPivot(root)
  if (!pivot) {
    root.position.fromArray(transform.position)
    root.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2])
    root.scale.fromArray(transform.scale)
    return
  }
  const pivotY = typeof pivot.userData.pivotY === 'number' ? pivot.userData.pivotY : 0
  root.position.fromArray(transform.position)
  root.rotation.set(0, 0, 0)
  root.scale.set(1, 1, 1)
  pivot.position.set(0, pivotY, 0)
  pivot.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2])
  pivot.scale.fromArray(transform.scale)
}

export function readTransformFromPivot(root: Object3D): {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
} {
  bakePivotTranslation(root)
  const pivot = getFootprintPivot(root)
  if (!pivot) {
    return {
      position: root.position.toArray() as [number, number, number],
      rotation: [root.rotation.x, root.rotation.y, root.rotation.z],
      scale: root.scale.toArray() as [number, number, number]
    }
  }
  return {
    position: root.position.toArray() as [number, number, number],
    rotation: [pivot.rotation.x, pivot.rotation.y, pivot.rotation.z],
    scale: pivot.scale.toArray() as [number, number, number]
  }
}
