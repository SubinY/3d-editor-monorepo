/** 将 Object3D 均匀装进 footprint（保比例，底面中心在原点）。 */
import type { FootprintSpec } from '../../../catalog/types'
import * as THREE from 'three'

export function fitObjectToFootprint(
  object: THREE.Object3D,
  footprint: FootprintSpec
): THREE.Object3D {
  const fw = Math.max(footprint.width, 1e-6)
  const fd = Math.max(footprint.depth, 1e-6)
  const fh = Math.max(footprint.height ?? footprint.depth ?? 1, 1e-6)

  object.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return object

  const size = new THREE.Vector3()
  box.getSize(size)
  const sx = size.x > 1e-8 ? fw / size.x : 1
  const sy = size.y > 1e-8 ? fh / size.y : 1
  const sz = size.z > 1e-8 ? fd / size.z : 1
  object.scale.multiplyScalar(Math.min(sx, sy, sz))
  object.updateMatrixWorld(true)

  const fitted = new THREE.Box3().setFromObject(object)
  const center = new THREE.Vector3()
  fitted.getCenter(center)
  object.position.x -= center.x
  object.position.z -= center.z
  object.position.y -= fitted.min.y
  object.updateMatrixWorld(true)
  return object
}
