import * as THREE from 'three'
import type { EnvironmentHelpersJSON } from '../../../document/types'

type EnclosureKind = EnvironmentHelpersJSON['enclosure']

function shellMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#2c3c4d',
    roughness: 0.72,
    metalness: 0.18,
    side: THREE.DoubleSide
  })
}

function doorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#3a4f63',
    roughness: 0.65,
    metalness: 0.22,
    side: THREE.DoubleSide
  })
}

function markShell(mesh: THREE.Mesh): void {
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.isShell = true
}

/** 通用五面开口盒：底/顶/后/左/右，缺 +Z 前脸 */
export function buildOpenBoxEnclosure(width: number, height: number, depth: number): THREE.Group {
  const group = new THREE.Group()
  group.name = '__openBox__'
  const mat = shellMaterial()
  const t = Math.min(0.04, Math.min(width, depth, height) * 0.08)

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), mat)
  bottom.position.set(0, t / 2, 0)

  const top = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), mat.clone())
  top.position.set(0, height - t / 2, 0)

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, t), mat.clone())
  back.position.set(0, height / 2, -depth / 2 + t / 2)

  const left = new THREE.Mesh(new THREE.BoxGeometry(t, height, depth), mat.clone())
  left.position.set(-width / 2 + t / 2, height / 2, 0)

  const right = new THREE.Mesh(new THREE.BoxGeometry(t, height, depth), mat.clone())
  right.position.set(width / 2 - t / 2, height / 2, 0)

  ;[bottom, top, back, left, right].forEach(mesh => {
    markShell(mesh)
    group.add(mesh)
  })
  return group
}

/**
 * 五面开口盒 + 开启的前柜门：
 * 壳体同 openBox；门铰在开口右侧（+X），绕 Y 外开约 100°。
 */
export function buildOpenBoxDoorEnclosure(
  width: number,
  height: number,
  depth: number
): THREE.Group {
  const group = buildOpenBoxEnclosure(width, height, depth)
  group.name = '__openBoxDoor__'

  const t = Math.min(0.04, Math.min(width, depth, height) * 0.08)
  const doorW = Math.max(width - t * 2, width * 0.9)
  const doorH = Math.max(height - t * 2, height * 0.9)

  const hinge = new THREE.Group()
  hinge.name = '__doorHinge__'
  // 铰链：开口右前棱
  hinge.position.set(width / 2 - t, height / 2, depth / 2)
  // 外开（朝向 +Z / +X 象限）
  hinge.rotation.y = Math.PI * (100 / 180)

  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, t), doorMaterial())
  // 门板原点在铰链侧，沿本地 -X 铺开
  door.position.set(-doorW / 2, 0, 0)
  markShell(door)
  hinge.add(door)

  // 简易拉手（靠门自由边）
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(t * 0.6, doorH * 0.12, t * 1.2),
    new THREE.MeshStandardMaterial({ color: '#c0c8d0', roughness: 0.35, metalness: 0.7 })
  )
  handle.position.set(-(doorW - t * 2), 0, t * 0.9)
  markShell(handle)
  hinge.add(handle)

  group.add(hinge)
  return group
}

/**
 * 五面开口盒 + 双扇外开前柜门：
 * 左门铰在 -X，右门铰在 +X，各外开约 100°；中缝留薄隙。
 */
export function buildOpenBoxDoubleDoorEnclosure(
  width: number,
  height: number,
  depth: number
): THREE.Group {
  const group = buildOpenBoxEnclosure(width, height, depth)
  group.name = '__openBoxDoubleDoor__'

  const t = Math.min(0.04, Math.min(width, depth, height) * 0.08)
  const gap = t * 0.5
  const doorW = Math.max((width - t * 2 - gap) / 2, width * 0.4)
  const doorH = Math.max(height - t * 2, height * 0.9)
  const openY = Math.PI * (100 / 180)
  const handleMat = new THREE.MeshStandardMaterial({
    color: '#c0c8d0',
    roughness: 0.35,
    metalness: 0.7
  })

  // 右门：铰在开口右前棱，沿本地 -X 铺开
  const rightHinge = new THREE.Group()
  rightHinge.name = '__doorHingeRight__'
  rightHinge.position.set(width / 2 - t, height / 2, depth / 2)
  rightHinge.rotation.y = openY
  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, t), doorMaterial())
  rightDoor.position.set(-doorW / 2, 0, 0)
  markShell(rightDoor)
  rightHinge.add(rightDoor)
  const rightHandle = new THREE.Mesh(
    new THREE.BoxGeometry(t * 0.6, doorH * 0.12, t * 1.2),
    handleMat
  )
  rightHandle.position.set(-(doorW - t * 2), 0, t * 0.9)
  markShell(rightHandle)
  rightHinge.add(rightHandle)
  group.add(rightHinge)

  // 左门：铰在开口左前棱，沿本地 +X 铺开
  const leftHinge = new THREE.Group()
  leftHinge.name = '__doorHingeLeft__'
  leftHinge.position.set(-(width / 2 - t), height / 2, depth / 2)
  leftHinge.rotation.y = -openY
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, t), doorMaterial().clone())
  leftDoor.position.set(doorW / 2, 0, 0)
  markShell(leftDoor)
  leftHinge.add(leftDoor)
  const leftHandle = new THREE.Mesh(
    new THREE.BoxGeometry(t * 0.6, doorH * 0.12, t * 1.2),
    handleMat.clone()
  )
  leftHandle.position.set(doorW - t * 2, 0, t * 0.9)
  markShell(leftHandle)
  leftHinge.add(leftHandle)
  group.add(leftHinge)

  return group
}

/** 按 environment.helpers.enclosure 构建；none 返回 null */
export function buildEnclosure(
  kind: EnclosureKind,
  width: number,
  height: number,
  depth: number
): THREE.Group | null {
  if (kind === 'openBox') return buildOpenBoxEnclosure(width, height, depth)
  if (kind === 'openBoxDoor') return buildOpenBoxDoorEnclosure(width, height, depth)
  if (kind === 'openBoxDoubleDoor') return buildOpenBoxDoubleDoorEnclosure(width, height, depth)
  return null
}
