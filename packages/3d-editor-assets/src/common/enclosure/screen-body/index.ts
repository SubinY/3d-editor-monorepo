import type * as THREE_NS from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import screenBodyUrl from './screen-body.glb?url'
import { fitGltfToFootprint } from '../utils/fit-gltf'

type Three = typeof THREE_NS

export { screenBodyUrl }

/**
 * 素材原生包围盒（直立、开口朝 +Z 校正前的本地几何，米）。
 * 宽 X × 高 Y × 深 Z ≈ 0.8 × 1.7 × 0.06（800 × 1700 × 60 mm）。
 */
export const SCREEN_BODY_NATIVE_SIZE = {
  width: 0.8,
  height: 1.7,
  depth: 0.06
} as const

/**
 * 屏体.glb：
 * - 节点带 +90°X，本地几何已是 Y-up → 清子节点旋转后直立
 * - 开口/柜门约定朝 +Z（与 openBox 一致）；素材开口朝 -Z → 绕 Y 转 180°
 */
function uprightScreenBody(root: THREE_NS.Object3D): void {
  root.traverse(child => {
    child.rotation.set(0, 0, 0)
  })
  root.rotation.y = Math.PI
  root.updateMatrixWorld(true)
}

let sourcePromise: Promise<THREE_NS.Object3D> | null = null

function loadSource(): Promise<THREE_NS.Object3D> {
  if (!sourcePromise) {
    sourcePromise = new GLTFLoader().loadAsync(screenBodyUrl).then(gltf => {
      uprightScreenBody(gltf.scene)
      return gltf.scene
    })
  }
  return sourcePromise
}

/** 按柜体 bounds 缩放的屏体壳 */
export async function buildScreenBodyEnclosure(
  THREE: Three,
  width: number,
  height: number,
  depth: number
): Promise<THREE_NS.Group> {
  const source = await loadSource()
  const group = fitGltfToFootprint(THREE, source, { width, height, depth })
  group.name = '__screenBody__'
  return group
}
