import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { resourceStore } from '@/stores/resource-store'

const gltfCache = new Map<string, THREE.Object3D>()

function cloneObject(source: THREE.Object3D): THREE.Object3D {
  return source.clone(true)
}

export async function loadModelFromResource(resourceId: string): Promise<THREE.Object3D> {
  const cached = gltfCache.get(resourceId)
  if (cached) return cloneObject(cached)

  const blob = await resourceStore.getBlob(resourceId)
  if (!blob) throw new Error(`资源不存在：${resourceId}`)

  const url = URL.createObjectURL(blob)
  try {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(url)
    const root = gltf.scene || new THREE.Group()
    gltfCache.set(resourceId, root)
    return cloneObject(root)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function clearModelResourceCache(resourceId?: string): void {
  if (!resourceId) {
    gltfCache.clear()
    return
  }
  gltfCache.delete(resourceId)
}
