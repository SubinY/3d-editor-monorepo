import type { FootprintSpec } from '@3d-editor/editor'

export interface BreakerModelOptions {
  footprint: FootprintSpec
}

/**
 * 简化塑壳断路器（参考 ComPacT 外观：灰壳 + 绿面板 + 手柄）。
 * 约定：原点底面中心；内容在 y∈[0,h]；正面 +Z；尺寸吃 footprint。
 */
export function createBreakerModel(
  THREE: typeof import('three'),
  options: BreakerModelOptions
): import('three').Group {
  const w = options.footprint.width
  const d = options.footprint.depth
  const h = options.footprint.height ?? 0.14

  const root = new THREE.Group()
  root.name = 'comp-breaker'

  const shellMat = new THREE.MeshStandardMaterial({
    color: '#3a3d42',
    roughness: 0.72,
    metalness: 0.12
  })
  const greenMat = new THREE.MeshStandardMaterial({
    color: '#2e9b4a',
    roughness: 0.55,
    metalness: 0.08
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#1a1c1f',
    roughness: 0.65,
    metalness: 0.15
  })
  const labelMat = new THREE.MeshStandardMaterial({
    color: '#4a4e54',
    roughness: 0.7,
    metalness: 0.1
  })

  function mark(mesh: import('three').Mesh): void {
    mesh.castShadow = true
    mesh.receiveShadow = true
  }

  // 主壳体
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.86, d * 0.92), shellMat)
  body.position.set(0, h * 0.5, -d * 0.02)
  mark(body)
  root.add(body)

  // 绿色前面板
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, h * 0.42, d * 0.06), greenMat)
  panel.position.set(0, h * 0.52, d * 0.42)
  mark(panel)
  root.add(panel)

  // OFF 窗口条
  const offBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.28, h * 0.05, d * 0.02), darkMat)
  offBar.position.set(0, h * 0.62, d * 0.46)
  mark(offBar)
  root.add(offBar)

  // 手柄
  const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, h * 0.16, d * 0.12), darkMat)
  handle.position.set(0, h * 0.48, d * 0.48)
  mark(handle)
  root.add(handle)

  // 上端子罩
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, h * 0.1, d * 0.7), darkMat)
  topCap.position.set(0, h * 0.93, -d * 0.05)
  mark(topCap)
  root.add(topCap)

  // 下端子罩
  const botCap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.08, d * 0.55), labelMat)
  botCap.position.set(0, h * 0.08, d * 0.05)
  mark(botCap)
  root.add(botCap)

  // 上下各 3 个端子示意
  const termW = w * 0.16
  const termH = h * 0.06
  const termD = d * 0.22
  for (let i = -1; i <= 1; i++) {
    const x = i * w * 0.28
    const top = new THREE.Mesh(new THREE.BoxGeometry(termW, termH, termD), darkMat)
    top.position.set(x, h * 0.98, d * 0.28)
    mark(top)
    root.add(top)

    const bot = new THREE.Mesh(new THREE.BoxGeometry(termW, termH, termD), darkMat)
    bot.position.set(x, h * 0.04, d * 0.32)
    mark(bot)
    root.add(bot)
  }

  return root
}
