import * as THREE from 'three'
import type { EnvironmentFloorJSON } from '../../../document/types'

export interface FloorMaterialHandle {
  material: THREE.MeshStandardMaterial
  dispose: () => void
}

export interface FloorUvBounds {
  width: number
  depth: number
  /** 中心偏移，默认原点 */
  centerU?: number
  centerV?: number
}

/** 单套地面材质；mapUrl 加载失败则退回纯色 */
export async function createFloorMaterial(
  floor: EnvironmentFloorJSON,
  uvBounds: FloorUvBounds
): Promise<FloorMaterialHandle> {
  const opacity = floor.opacity ?? 1
  const material = new THREE.MeshStandardMaterial({
    color: floor.color || '#1a3048',
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.FrontSide,
    transparent: opacity < 1,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  })

  let texture: THREE.Texture | null = null
  if (floor.mapUrl) {
    try {
      texture = await new THREE.TextureLoader().loadAsync(floor.mapUrl)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      const cell = Math.max(floor.mapRepeat ?? 4, 0.1)
      texture.repeat.set(
        Math.max(uvBounds.width / cell, 1),
        Math.max(uvBounds.depth / cell, 1)
      )
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

export function outlineToUvBounds(outline: [number, number][]): FloorUvBounds {
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const [u, v] of outline) {
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }
  const width = Math.max(maxU - minU, 0.01)
  const depth = Math.max(maxV - minV, 0.01)
  return {
    width,
    depth,
    centerU: (minU + maxU) / 2,
    centerV: (minV + maxV) / 2
  }
}

/**
 * 工作区多边形地板。ShapeGeometry UV 按 outline AABB 归一化。
 */
export function createPolygonFloorMesh(
  outline: [number, number][],
  material: THREE.MeshStandardMaterial
): THREE.Mesh | null {
  if (outline.length < 3) return null
  const shape = new THREE.Shape()
  shape.moveTo(outline[0][0], -outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(outline[i][0], -outline[i][1])
  }
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape)
  const uvBounds = outlineToUvBounds(outline)
  const pos = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const hw = uvBounds.width / 2
  const hd = uvBounds.depth / 2
  const cu = uvBounds.centerU ?? 0
  const cv = uvBounds.centerV ?? 0
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    // shape：x→世界 u，y→世界 -v
    const worldU = x
    const worldV = -y
    uv.setXY(
      i,
      (worldU - cu + hw) / uvBounds.width,
      (worldV - cv + hd) / uvBounds.depth
    )
  }
  uv.needsUpdate = true
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0
  mesh.receiveShadow = true
  mesh.userData.nonSelectable = true
  return mesh
}

/** 天花复用地面加载；仰视需看见底面，用 DoubleSide */
export async function createCeilingMaterial(
  ceiling: EnvironmentFloorJSON,
  uvBounds: FloorUvBounds
): Promise<FloorMaterialHandle> {
  const handle = await createFloorMaterial(ceiling, uvBounds)
  handle.material.side = THREE.DoubleSide
  return handle
}

export function createPolygonCeilingMesh(
  outline: [number, number][],
  material: THREE.MeshStandardMaterial,
  height: number
): THREE.Mesh | null {
  const mesh = createPolygonFloorMesh(outline, material)
  if (!mesh) return null
  mesh.position.y = height
  return mesh
}
