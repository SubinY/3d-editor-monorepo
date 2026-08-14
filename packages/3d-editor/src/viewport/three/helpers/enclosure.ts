import * as THREE from 'three'

function shellMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#2c3c4d',
    roughness: 0.72,
    metalness: 0.18,
    side: THREE.DoubleSide
  })
}

function markShell(mesh: THREE.Mesh): void {
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.isShell = true
}

/** 通用五面开口盒：底/顶/后/左/右，缺 +Z 前脸（内核唯一内建壳） */
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

/** 内核内建壳：仅 openBox；其它 id 由 Host/assets procedural 解析 */
export function buildEnclosure(
  kind: string,
  width: number,
  height: number,
  depth: number
): THREE.Group | null {
  if (kind === 'openBox') return buildOpenBoxEnclosure(width, height, depth)
  return null
}
