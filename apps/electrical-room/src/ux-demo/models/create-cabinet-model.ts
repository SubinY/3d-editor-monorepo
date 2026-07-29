import type { FootprintSpec } from '@3d-editor/editor'

export interface CabinetModelOptions {
  footprint: FootprintSpec
}

/**
 * 设计稿风格配电柜：灰壳、正面仪表门、侧指示灯。
 * 原点底面中心；y 向上；正面 +Z。
 */
export function createCabinetModel(
  THREE: typeof import('three'),
  options: CabinetModelOptions
): import('three').Group {
  const w = options.footprint.width
  const d = options.footprint.depth
  const h = options.footprint.height ?? 2.2

  const root = new THREE.Group()
  root.name = 'ux-cabinet'

  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#8a939e',
    roughness: 0.55,
    metalness: 0.35
  })
  const doorMat = new THREE.MeshStandardMaterial({
    color: '#9aa3ad',
    roughness: 0.5,
    metalness: 0.28
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#2b3038',
    roughness: 0.6,
    metalness: 0.2
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: '#1f7a3a',
    roughness: 0.4,
    metalness: 0.15,
    emissive: '#0d3d1c',
    emissiveIntensity: 0.35
  })
  const screenMat = new THREE.MeshStandardMaterial({
    color: '#0e1a14',
    roughness: 0.35,
    metalness: 0.1,
    emissive: '#143d28',
    emissiveIntensity: 0.4
  })

  function mark(mesh: import('three').Mesh): void {
    mesh.castShadow = true
    mesh.receiveShadow = true
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d * 0.92), bodyMat)
  body.position.set(0, h / 2, -d * 0.02)
  mark(body)
  root.add(body)

  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.88, 0.03), doorMat)
  door.position.set(0, h * 0.48, d * 0.46)
  mark(door)
  root.add(door)

  const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, h * 0.28, 0.02), darkMat)
  panel.position.set(-w * 0.08, h * 0.62, d * 0.48)
  mark(panel)
  root.add(panel)

  const screen = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h * 0.1, 0.015), screenMat)
  screen.position.set(-w * 0.12, h * 0.66, d * 0.5)
  mark(screen)
  root.add(screen)

  for (let i = 0; i < 3; i++) {
    const bay = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h * 0.14, 0.02), darkMat)
    bay.position.set(w * 0.28, h * (0.72 - i * 0.18), d * 0.49)
    mark(bay)
    root.add(bay)
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), accentMat)
    led.position.set(w * 0.38, h * (0.76 - i * 0.18), d * 0.51)
    mark(led)
    root.add(led)
  }

  const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.06, d * 1.02), darkMat)
  base.position.set(0, 0.03, 0)
  mark(base)
  root.add(base)

  return root
}
