/** 节点根下的 footprint 几何中心枢轴：position 仍在底面，旋转/缩放绕中心（对齐 2D layout.center）。 */
import type { Object3D } from 'three'
import type { CatalogItem } from '../../../catalog/types'
import type { TransformJSON } from '../../../document/types'

/**
 * 存盘旋转是顺时针世界轴。Three 为右手系：order ZYX 且三轴取负，
 * 等价于先绕世界 X、再世界 Y、再世界 Z 的顺时针转。
 */
export function applyDocumentRotation(
  object: Object3D,
  rotation: TransformJSON['rotation']
): void {
  object.rotation.order = 'ZYX'
  object.rotation.set(-rotation[0], -rotation[1], -rotation[2])
}

/** 从已施加的 Three 欧拉读回存盘角（ZYX 取负的逆） */
export function readDocumentRotation(object: Object3D): TransformJSON['rotation'] {
  return [-object.rotation.x, -object.rotation.y, -object.rotation.z]
}

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
    applyDocumentRotation(root, transform.rotation)
    root.scale.fromArray(transform.scale)
    return
  }
  const pivotY = typeof pivot.userData.pivotY === 'number' ? pivot.userData.pivotY : 0
  root.position.fromArray(transform.position)
  root.rotation.set(0, 0, 0)
  root.scale.set(1, 1, 1)
  pivot.position.set(0, pivotY, 0)
  applyDocumentRotation(pivot, transform.rotation)
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
      rotation: readDocumentRotation(root),
      scale: root.scale.toArray() as [number, number, number]
    }
  }
  return {
    position: root.position.toArray() as [number, number, number],
    rotation: readDocumentRotation(pivot),
    scale: pivot.scale.toArray() as [number, number, number]
  }
}
