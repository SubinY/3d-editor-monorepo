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
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity
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
  mesh.position.y = 0.01
  mesh.receiveShadow = true
  mesh.userData.nonSelectable = true
  return mesh
}

/** 天花材质与地面同合同字段，复用加载逻辑 */
export const createCeilingMaterial = createFloorMaterial

/** bounds 矩形天花；Y = height，法线朝下（旋转 +X） */
export function createSiteCeilingMesh(
  bounds: BoundsJSON,
  material: THREE.MeshStandardMaterial,
  height: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.width, bounds.depth),
    material
  )
  mesh.rotation.x = Math.PI / 2
  mesh.position.y = height
  mesh.receiveShadow = true
  mesh.userData.nonSelectable = true
  return mesh
}

/** 闭合墙环天花；与 createRoomFloorMesh 同 UV，抬到 height */
export function createRoomCeilingMesh(
  points: Array<{ u: number; v: number }>,
  material: THREE.MeshStandardMaterial,
  bounds: BoundsJSON,
  height: number
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
    uv.setXY(i, (x + hw) / bounds.width, (y + hd) / bounds.depth)
  }
  uv.needsUpdate = true
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = Math.PI / 2
  mesh.position.y = height
  mesh.receiveShadow = true
  mesh.userData.nonSelectable = true
  return mesh
}
