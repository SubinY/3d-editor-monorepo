import * as THREE from 'three'

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

/** 户外柜：浅灰漆面 */
function outdoorShellMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#c9cbc9',
    roughness: 0.78,
    metalness: 0.12,
    side: THREE.DoubleSide
  })
}

function outdoorDoorMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#d0d2d0',
    roughness: 0.74,
    metalness: 0.1,
    side: THREE.DoubleSide
  })
}

function outdoorMetalMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#9aa0a4',
    roughness: 0.42,
    metalness: 0.65
  })
}

function markShell(mesh: THREE.Mesh): void {
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.isShell = true
}

/** 五面开口盒（门壳的底板）；与内核 openBox 同形 */
function buildOpenBoxBase(width: number, height: number, depth: number): THREE.Group {
  const group = new THREE.Group()
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
 * 五面开口盒 + 单扇外开前门：
 * 壳体同 openBox；门铰在开口右侧（+X），绕 Y 外开约 100°。
 */
export function buildOpenBoxDoorEnclosure(
  width: number,
  height: number,
  depth: number
): THREE.Group {
  const group = buildOpenBoxBase(width, height, depth)
  group.name = '__openBoxDoor__'

  const t = Math.min(0.04, Math.min(width, depth, height) * 0.08)
  const doorW = Math.max(width - t * 2, width * 0.9)
  const doorH = Math.max(height - t * 2, height * 0.9)

  const hinge = new THREE.Group()
  hinge.name = '__doorHinge__'
  hinge.position.set(width / 2 - t, height / 2, depth / 2)
  hinge.rotation.y = Math.PI * (100 / 180)

  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, t), doorMaterial())
  door.position.set(-doorW / 2, 0, 0)
  markShell(door)
  hinge.add(door)

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
 * 五面开口盒 + 双扇外开前门：
 * 左门铰在 -X，右门铰在 +X，各外开约 100°；中缝留薄隙。
 */
export function buildOpenBoxDoubleDoorEnclosure(
  width: number,
  height: number,
  depth: number
): THREE.Group {
  const group = buildOpenBoxBase(width, height, depth)
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

/**
 * 户外双门柜：五面开口壳体 + 双坡顶盖 + 底座百叶 + 铆钉门板 + 中缝锁扣。
 */
export function buildOutdoorCabinetEnclosure(
  width: number,
  height: number,
  depth: number
): THREE.Group {
  const group = new THREE.Group()
  group.name = '__outdoorCabinet__'

  const t = Math.min(0.04, Math.min(width, depth, height) * 0.06)
  const roofH = height * 0.07
  const plinthH = height * 0.12
  const bodyH = height - roofH - plinthH
  const bodyY0 = plinthH
  const bodyY1 = plinthH + bodyH
  const shellMat = outdoorShellMaterial()
  const doorMat = outdoorDoorMaterial()
  const metalMat = outdoorMetalMaterial()

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width, plinthH, depth), shellMat)
  plinth.position.set(0, plinthH / 2, 0)
  markShell(plinth)
  group.add(plinth)

  const louverCount = 5
  const louverGap = plinthH * 0.08
  const louverH = Math.max((plinthH - louverGap * (louverCount + 1)) / louverCount, t * 0.2)
  const louverW = width * 0.88
  const louverD = t * 0.55
  for (let i = 0; i < louverCount; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(louverW, louverH, louverD), shellMat)
    const y = louverGap + louverH / 2 + i * (louverH + louverGap)
    bar.position.set(0, y, depth / 2 + louverD * 0.35)
    markShell(bar)
    group.add(bar)
  }

  const top = new THREE.Mesh(new THREE.BoxGeometry(width, t, depth), shellMat)
  top.position.set(0, bodyY1 - t / 2, 0)

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, bodyH, t), shellMat)
  back.position.set(0, bodyY0 + bodyH / 2, -depth / 2 + t / 2)

  const left = new THREE.Mesh(new THREE.BoxGeometry(t, bodyH, depth), shellMat)
  left.position.set(-width / 2 + t / 2, bodyY0 + bodyH / 2, 0)

  const right = new THREE.Mesh(new THREE.BoxGeometry(t, bodyH, depth), shellMat)
  right.position.set(width / 2 - t / 2, bodyY0 + bodyH / 2, 0)

  ;[top, back, left, right].forEach(mesh => {
    markShell(mesh)
    group.add(mesh)
  })

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(t * 0.35, bodyH * 0.08, depth * 0.22),
    shellMat
  )
  badge.position.set(-width / 2 - t * 0.05, bodyY0 + bodyH * 0.78, -depth * 0.08)
  markShell(badge)
  group.add(badge)

  const overhang = Math.min(width, depth) * 0.035
  const roofW = width + overhang * 2
  const roofD = depth + overhang * 2
  const halfW = roofW / 2

  const roofShape = new THREE.Shape()
  roofShape.moveTo(-halfW, 0)
  roofShape.lineTo(halfW, 0)
  roofShape.lineTo(halfW * 0.94, roofH * 0.45)
  roofShape.lineTo(0, roofH)
  roofShape.lineTo(-halfW * 0.94, roofH * 0.45)
  roofShape.closePath()

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: roofD,
    bevelEnabled: false
  })
  const roof = new THREE.Mesh(roofGeo, shellMat)
  roof.position.set(0, bodyY1, -roofD / 2)
  markShell(roof)
  group.add(roof)

  const seam = new THREE.Mesh(new THREE.BoxGeometry(t * 0.4, roofH * 0.18, roofD * 0.98), shellMat)
  seam.position.set(0, bodyY1 + roofH * 0.9, 0)
  markShell(seam)
  group.add(seam)

  const gap = t * 0.45
  const doorW = Math.max((width - t * 2 - gap) / 2, width * 0.38)
  const doorH = Math.max(bodyH - t * 1.5, bodyH * 0.9)
  const doorY = bodyY0 + bodyH / 2
  const openY = Math.PI * (100 / 180)
  const rivetR = Math.min(t * 0.28, 0.012)
  const rivetGeo = new THREE.SphereGeometry(rivetR, 6, 4)

  function addDoor(hingeX: number, sign: 1 | -1, name: string, withLatch: boolean): void {
    const hinge = new THREE.Group()
    hinge.name = name
    hinge.position.set(hingeX, doorY, depth / 2)
    hinge.rotation.y = sign * openY

    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, t), doorMat)
    door.position.set(-sign * (doorW / 2), 0, 0)
    markShell(door)
    hinge.add(door)

    const cols = 3
    const rows = 4
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rivet = new THREE.Mesh(rivetGeo, metalMat)
        const u = (c + 0.5) / cols
        const v = (r + 0.5) / rows
        rivet.position.set(
          -sign * (doorW * (0.12 + u * 0.76)),
          doorH * (v - 0.5) * 0.82,
          t * 0.55
        )
        markShell(rivet)
        hinge.add(rivet)
      }
    }

    if (withLatch) {
      const latchBody = new THREE.Mesh(
        new THREE.BoxGeometry(t * 1.1, doorH * 0.1, t * 1.4),
        metalMat
      )
      latchBody.position.set(-sign * (doorW - t * 1.2), 0, t * 0.9)
      markShell(latchBody)
      hinge.add(latchBody)

      const latchHandle = new THREE.Mesh(
        new THREE.BoxGeometry(t * 0.45, doorH * 0.14, t * 0.55),
        metalMat
      )
      latchHandle.position.set(-sign * (doorW - t * 1.2), -doorH * 0.02, t * 1.5)
      markShell(latchHandle)
      hinge.add(latchHandle)
    }

    group.add(hinge)
  }

  addDoor(width / 2 - t, 1, '__doorHingeRight__', true)
  addDoor(-(width / 2 - t), -1, '__doorHingeLeft__', false)

  return group
}
