import * as THREE from 'three'
import type { EnvironmentWallJSON } from '../../../document/types'

export interface WallMaterialHandle {
  material: THREE.MeshStandardMaterial
  dispose: () => void
}

/** 场景墙共用材质；mapUrl 加载失败则退回纯色 */
export async function createWallMaterial(
  wall: EnvironmentWallJSON
): Promise<WallMaterialHandle> {
  const opacity = wall.opacity ?? 0.92
  const material = new THREE.MeshStandardMaterial({
    color: wall.color || '#233242',
    roughness: 0.85,
    metalness: 0.05,
    transparent: opacity < 1,
    opacity
  })

  let texture: THREE.Texture | null = null
  if (wall.mapUrl) {
    try {
      texture = await new THREE.TextureLoader().loadAsync(wall.mapUrl)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      // 单面 UV 0–1；各墙 mesh 再建时按长/高写入 UV 缩放
      texture.repeat.set(1, 1)
      texture.colorSpace = THREE.SRGBColorSpace
      material.map = texture
      material.needsUpdate = true
    } catch {
      // 局域网或路径失败：保持纯色
    }
  }

  return {
    material,
    dispose: () => {
      if (texture) texture.dispose()
      material.dispose()
    }
  }
}

/** BoxGeometry UV 按墙长/高缩放，使 mapRepeat（米/格）在世界尺度生效 */
export function scaleWallBoxUVs(
  geometry: THREE.BufferGeometry,
  length: number,
  height: number,
  mapRepeat: number
): void {
  const cell = Math.max(mapRepeat, 0.1)
  const uScale = Math.max(length / cell, 0.01)
  const vScale = Math.max(height / cell, 0.01)
  const uv = geometry.getAttribute('uv')
  if (!uv) return
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale)
  }
  uv.needsUpdate = true
}
