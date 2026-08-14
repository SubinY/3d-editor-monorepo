import type * as THREE from 'three'

/**
 * 释放材质及其引用的贴图。
 * Material.dispose() 不会释放 map / normalMap 等 Texture，必须成对处理。
 */
export function disposeMaterial(mat: THREE.Material): void {
  const record = mat as THREE.Material & Record<string, unknown>
  for (const key of Object.keys(record)) {
    const value = record[key]
    if (value && typeof value === 'object' && (value as { isTexture?: boolean }).isTexture) {
      ;(value as THREE.Texture).dispose()
    }
  }
  mat.dispose()
}

/** 释放 Object3D 子树上的 geometry / material（含贴图） */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse(child => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(m => {
      if (m) disposeMaterial(m)
    })
  })
}
