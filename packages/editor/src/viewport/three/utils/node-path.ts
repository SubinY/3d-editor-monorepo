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
