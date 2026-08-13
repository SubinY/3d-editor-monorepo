/** 沿 Object3D 父链解析 userData.nodePath（纯函数） */
import type * as THREE from 'three'

export function findNodePath(object: THREE.Object3D): string | undefined {
  let current: THREE.Object3D | null = object
  while (current) {
    if (typeof current.userData.nodePath === 'string') return current.userData.nodePath
    current = current.parent
  }
  return undefined
}

/** 判断 object 是否为 root 自身或其子孙 */
export function isObjectUnder(object: THREE.Object3D, root: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current === root) return true
    current = current.parent
  }
  return false
}
