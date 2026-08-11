import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import type { BoundsJSON, EnvironmentJSON } from '../../../document/types'
import type { ThreeRuntime } from '../runtime/ThreeRuntime'
import { buildEnclosure } from '../helpers/enclosure'

const FALLBACK_BG = '#0c1420'

export interface EnvironmentServiceOptions {
  runtime: ThreeRuntime
  envGroup: THREE.Group
  /** Host：覆盖 enclosure 几何（如 outdoorCabinet） */
  resolveEnclosure?: (
    kind: NonNullable<EnvironmentJSON['helpers']['enclosure']>,
    size: { width: number; height: number; depth: number }
  ) => Promise<THREE.Object3D | null | undefined> | THREE.Object3D | null | undefined
}

/**
 * Document.environment → Three 场景呈现（背景 / 灯 / 阴影 / grid / enclosure）。
 */
export class EnvironmentService {
  private runtime: ThreeRuntime
  private envGroup: THREE.Group
  private resolveEnclosure?: EnvironmentServiceOptions['resolveEnclosure']
  private applyToken = 0
  private bgTexture: THREE.Texture | null = null

  constructor(options: EnvironmentServiceOptions) {
    this.runtime = options.runtime
    this.envGroup = options.envGroup
    this.resolveEnclosure = options.resolveEnclosure
  }

  async apply(env: EnvironmentJSON, bounds: BoundsJSON): Promise<void> {
    const token = ++this.applyToken
    this.clearEnvGroup()
    this.runtime.setShadowMap({
      enabled: env.shadows.enabled,
      type: env.shadows.type ?? 'pcfsoft'
    })

    await this.applyBackground(env, token)
    if (token !== this.applyToken) return

    for (const spec of env.lights) {
      const light = this.createLight(spec, bounds)
      if (!light) continue
      this.envGroup.add(light)
      if (light instanceof THREE.DirectionalLight) {
        this.envGroup.add(light.target)
      }
    }

    const { width, depth, height } = bounds
    const h = height ?? 2

    if (env.helpers.grid) {
      const size = Math.max(width, depth, 1)
      const grid = new THREE.GridHelper(size, Math.max(Math.round(size), 1), 0x2b3b4d, 0x1c2836)
      ;(grid.material as THREE.Material).transparent = true
      ;(grid.material as THREE.Material).opacity = 0.5
      this.envGroup.add(grid)
    }

    const enclosureKind = env.helpers.enclosure
    let enclosure: THREE.Object3D | null = null
    if (enclosureKind && enclosureKind !== 'none') {
      const custom = this.resolveEnclosure
        ? await this.resolveEnclosure(enclosureKind, { width, height: h, depth })
        : null
      if (token !== this.applyToken) return
      enclosure =
        (custom as THREE.Object3D | null | undefined) ??
        buildEnclosure(enclosureKind, width, h, depth)
    }
    if (enclosure) this.envGroup.add(enclosure)

    this.markNonSelectable(this.envGroup)
    this.envGroup.traverse(child => {
      child.raycast = () => {}
    })
  }

  dispose(): void {
    this.applyToken++
    this.clearEnvGroup()
    this.disposeBgTexture()
  }

  private async applyBackground(env: EnvironmentJSON, token: number): Promise<void> {
    const bg = env.background
    if (bg.type === 'color') {
      this.disposeBgTexture()
      this.runtime.scene.background = new THREE.Color(bg.value)
      return
    }

    try {
      const texture = await this.loadEquirect(bg.url)
      if (token !== this.applyToken) {
        texture.dispose()
        return
      }
      this.disposeBgTexture()
      texture.mapping = THREE.EquirectangularReflectionMapping
      this.bgTexture = texture
      this.runtime.scene.background = texture
    } catch {
      if (token !== this.applyToken) return
      this.disposeBgTexture()
      this.runtime.scene.background = new THREE.Color(FALLBACK_BG)
    }
  }

  private loadEquirect(url: string): Promise<THREE.Texture> {
    const lower = url.toLowerCase()
    if (lower.endsWith('.hdr') || lower.endsWith('.exr')) {
      return new RGBELoader().loadAsync(url)
    }
    return new THREE.TextureLoader().loadAsync(url)
  }

  private createLight(
    spec: EnvironmentJSON['lights'][number],
    bounds: BoundsJSON
  ): THREE.Light | null {
    const color = spec.color ?? '#ffffff'
    const intensity = spec.intensity ?? 1
    if (spec.type === 'ambient') {
      return new THREE.AmbientLight(color, intensity)
    }
    if (spec.type === 'directional') {
      const dir = new THREE.DirectionalLight(color, intensity)
      const pos = spec.position ?? [5, 10, 5]
      dir.position.set(pos[0], pos[1], pos[2])
      dir.castShadow = spec.castShadow ?? false
      // 目标对准场景中心，阴影相机才能盖住工作区
      dir.target.position.set(0, 0, 0)
      if (dir.castShadow) this.configureDirectionalShadow(dir, bounds)
      return dir
    }
    return null
  }

  /**
   * 按 bounds 扩大平行光阴影正交范围。
   * Three 默认 shadow.camera 约 ±5，大场景会出现：框外无影、空白处整块三角暗斑（贴图边界伪影）。
   */
  private configureDirectionalShadow(dir: THREE.DirectionalLight, bounds: BoundsJSON): void {
    const half = Math.max(bounds.width, bounds.depth, 4) * 0.5
    // 略大于工作区，避免贴图裁切；过大则阴影变糊
    const extent = half * 1.35
    const height = bounds.height ?? Math.max(half, 2)

    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.bias = -0.0002
    dir.shadow.normalBias = 0.03

    const cam = dir.shadow.camera
    cam.left = -extent
    cam.right = extent
    cam.top = extent
    cam.bottom = -extent
    cam.near = 0.5
    cam.far = Math.max(dir.position.length() + height * 2, extent * 3, 40)
    cam.updateProjectionMatrix()
  }

  private clearEnvGroup(): void {
    while (this.envGroup.children.length) {
      const child = this.envGroup.children[0]
      this.envGroup.remove(child)
      child.traverse(obj => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach(m => m?.dispose?.())
        }
      })
    }
  }

  private disposeBgTexture(): void {
    if (this.bgTexture) {
      this.bgTexture.dispose()
      this.bgTexture = null
    }
  }

  private markNonSelectable(object: THREE.Object3D): void {
    object.traverse(child => {
      child.userData.nonSelectable = true
    })
    object.userData.nonSelectable = true
  }
}
