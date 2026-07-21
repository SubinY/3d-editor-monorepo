import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface LoadResult {
  scene: THREE.Group | THREE.Object3D
  animations?: THREE.AnimationClip[]
}

export class AssetLoader {
  async loadGLTF(url: string, onProgress?: (progress: number) => void): Promise<LoadResult> {
    // 设置纹理路径的基础目录（相对于GLTF文件的位置）
    const basePath = url.substring(0, url.lastIndexOf('/') + 1)
    const loader = new GLTFLoader()
    
    // 设置加载器的路径，这样纹理的相对路径才能正确解析
    const textureLoader = new THREE.TextureLoader()
    textureLoader.setPath(basePath)
    
    const gltf = await loader.loadAsync(url, event => {
      if (!onProgress) return
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total)
      }
    })
    return { scene: gltf.scene, animations: gltf.animations }
  }
}
