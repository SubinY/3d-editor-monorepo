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

function disposeShadowMap(object: THREE.Object3D): void {
  const light = object as THREE.Light
  if (!light.isLight || !light.shadow?.map) return
  light.shadow.map.dispose()
  light.shadow.map = null
}

/**
 * 释放 Object3D 子树上的 geometry / material（含贴图）以及灯光 shadow map。
 * GridHelper 是 Line 不是 Mesh；平行光的 shadow.map 是独立 RenderTarget 贴图。
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse(child => {
    disposeShadowMap(child)

    const obj = child as THREE.Mesh & THREE.Line
    if (obj.geometry) obj.geometry.dispose()

    const material = obj.material
    if (!material) return
    const materials = Array.isArray(material) ? material : [material]
    materials.forEach(m => {
      if (m) disposeMaterial(m)
    })
  })
}
