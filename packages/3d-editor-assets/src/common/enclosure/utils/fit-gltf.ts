import type * as THREE_NS from 'three'

type Three = typeof THREE_NS

/**
 * 将 GLTF 根节点非均匀缩放到目标柜体尺寸，并落到底面 Y=0、XZ 居中。
 * 与开口盒约定一致：X=宽、Y=高、Z=深。
 */
export function fitGltfToFootprint(
  THREE: Three,
  source: THREE_NS.Object3D,
  size: { width: number; height: number; depth: number }
): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = '__gltfEnclosure__'
  /** 实心 GLB 壳：场景嵌套时勿强制半透明（避免邻柜透过来） */
  group.userData.solidShell = true

  const root = source.clone(true)
  root.traverse(child => {
    child.userData.gltfShared = true
    child.userData.solidShell = true
    const mesh = child as THREE_NS.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.isShell = true
  })
  group.add(root)

  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const native = box.getSize(new THREE.Vector3())
  const sx = size.width / Math.max(native.x, 1e-6)
  const sy = size.height / Math.max(native.y, 1e-6)
  const sz = size.depth / Math.max(native.z, 1e-6)
  root.scale.set(sx, sy, sz)

  root.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(root)
  const center = fitted.getCenter(new THREE.Vector3())
  root.position.set(-center.x, -fitted.min.y, -center.z)

  return group
}
