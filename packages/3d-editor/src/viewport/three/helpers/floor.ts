import * as THREE from 'three'
import type { BoundsJSON, EnvironmentFloorJSON } from '../../../document/types'

export interface FloorMaterialHandle {
  material: THREE.MeshStandardMaterial
  dispose: () => void
}

/** 单套地面材质；mapUrl 加载失败则退回纯色 */
export async function createFloorMaterial(
  floor: EnvironmentFloorJSON,
  bounds: BoundsJSON
): Promise<FloorMaterialHandle> {
  const opacity = floor.opacity ?? 1
  const material = new THREE.MeshStandardMaterial({
    color: floor.color || '#1a3048',
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.FrontSide,
    transparent: opacity < 1,
    opacity,
    // 大平面贴地/贴网格拉近看时更稳
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
        Math.max(bounds.width / cell, 1),
        Math.max(bounds.depth / cell, 1)
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

export function createSiteFloorMesh(
  bounds: BoundsJSON,
  material: THREE.MeshStandardMaterial
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.width, bounds.depth),
    material
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0
  mesh.receiveShadow = true
  mesh.userData.nonSelectable = true
  return mesh
}

/**
 * 闭合墙内地板。ShapeGeometry 默认 UV=形状坐标（米），与场地 PlaneGeometry 的 0–1 UV
 * 不一致，会导致同材质贴图尺度错乱；此处按场地 bounds 重写成与 site 相同的 0–1 UV。
 */
export function createRoomFloorMesh(
  points: Array<{ u: number; v: number }>,
  material: THREE.MeshStandardMaterial,
  bounds: BoundsJSON
): THREE.Mesh | null {
  if (points.length < 3) return null
  const shape = new THREE.Shape()
  shape.moveTo(points[0].u, -points[0].v)
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].u, -points[i].v)
  }
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape)
  const pos = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const hw = bounds.width / 2
  const hd = bounds.depth / 2
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    // shape 平面：x→世界 u，y→世界 -v；与 PlaneGeometry 旋转后采样一致
    uv.setXY(i, (x + hw) / bounds.width, (y + hd) / bounds.depth)
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
  bounds: BoundsJSON
): Promise<FloorMaterialHandle> {
  const handle = await createFloorMaterial(ceiling, bounds)
  handle.material.side = THREE.DoubleSide
  return handle
}

/** bounds 矩形天花；与场地地板同一旋转，抬到净高（材质 DoubleSide，仰视可见） */
export function createSiteCeilingMesh(
  bounds: BoundsJSON,
  material: THREE.MeshStandardMaterial,
  height: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.width, bounds.depth),
    material
  )
  // 与 createSiteFloorMesh 同为 -X，避免 +X 与 shape 约定不一致
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = height
  mesh.receiveShadow = true
  mesh.userData.nonSelectable = true
  return mesh
}

/**
 * 闭合墙环天花：与 createRoomFloorMesh 同一套 shape→世界坐标（-X 旋转），
 * 仅 Y 抬到 height。旧实现用 +X 旋转会导致 V 轴镜像，封闭区域看起来「铺反/偏到墙外」。
 */
export function createRoomCeilingMesh(
  points: Array<{ u: number; v: number }>,
  material: THREE.MeshStandardMaterial,
  bounds: BoundsJSON,
  height: number
): THREE.Mesh | null {
  const mesh = createRoomFloorMesh(points, material, bounds)
  if (!mesh) return null
  mesh.position.y = height
  return mesh
}
