import * as THREE from 'three'

export interface MaterialOptions {
  color?: string
  metalness?: number
  roughness?: number
  map?: string
}

/**
 * 实用材质编辑器：帮助在属性面板中快速应用 MeshStandardMaterial。
 */
export class MaterialEditor {
  async applyStandardMaterial(object: THREE.Object3D, options: MaterialOptions): Promise<void> {
    if (!('material' in object)) return
    const mesh = object as THREE.Mesh
    const material = (mesh.material as THREE.MeshStandardMaterial) || new THREE.MeshStandardMaterial()
    if (options.color) material.color.set(options.color)
    if (options.metalness !== undefined) material.metalness = options.metalness
    if (options.roughness !== undefined) material.roughness = options.roughness
    if (options.map) {
      material.map = await this.loadTexture(options.map)
      material.map.needsUpdate = true
    }
    mesh.material = material
  }

  private loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(url, resolve, undefined, reject)
    })
  }
}

