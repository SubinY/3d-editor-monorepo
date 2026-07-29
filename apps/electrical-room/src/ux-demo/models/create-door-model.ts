import type { FootprintSpec } from '@3d-editor/editor'

export interface DoorModelOptions {
  footprint: FootprintSpec
}

/** 简易房间门：门框 + 门扇 */
export function createDoorModel(
  THREE: typeof import('three'),
  options: DoorModelOptions
): import('three').Group {
  const w = options.footprint.width
  const d = Math.max(options.footprint.depth, 0.08)
  const h = options.footprint.height ?? 2.1

  const root = new THREE.Group()
  root.name = 'ux-door'

  const frameMat = new THREE.MeshStandardMaterial({
    color: '#6b7280',
    roughness: 0.7,
    metalness: 0.15
  })
  const leafMat = new THREE.MeshStandardMaterial({
    color: '#c9973f',
    roughness: 0.65,
    metalness: 0.08
  })

  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, d), frameMat)
  frameL.position.set(-w / 2 + 0.03, h / 2, 0)
  const frameR = frameL.clone()
  frameR.position.x = w / 2 - 0.03
  const frameT = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), frameMat)
  frameT.position.set(0, h - 0.03, 0)

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h - 0.1, 0.04), leafMat)
  leaf.position.set(0, (h - 0.1) / 2, 0)

  ;[frameL, frameR, frameT, leaf].forEach(m => {
    m.castShadow = true
    m.receiveShadow = true
    root.add(m)
  })

  return root
}
