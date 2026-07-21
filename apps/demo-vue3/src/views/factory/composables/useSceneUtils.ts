import type { CoreContext } from '@3d-editor/engine'
import * as THREE from 'three'

/**
 * 找到场景图的根节点（Scene 的直接子对象）
 */
export function findRoot(object: THREE.Object3D): THREE.Object3D {
  let node = object
  while (node.parent && node.parent.type !== 'Scene') {
    node = node.parent
  }
  return node
}

/**
 * 将屏幕坐标投射到地面（Y=0 平面）
 */
export function projectToFloor(
  clientX: number,
  clientY: number,
  ctx: CoreContext
): THREE.Vector3 | null {
  const rect = ctx.renderer.domElement.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -((clientY - rect.top) / rect.height) * 2 + 1
  const ray = new THREE.Raycaster()
  ray.setFromCamera(new THREE.Vector2(x, y), ctx.cameraManager.camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const target = new THREE.Vector3()
  return ray.ray.intersectPlane(plane, target)
}

