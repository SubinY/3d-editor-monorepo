import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { BoundsJSON, EnvironmentJSON } from '../../../document/types'
import type { ThreeRuntime } from '../runtime/ThreeRuntime'
import { buildEnclosure } from '../helpers/enclosure'
import { createInfiniteGrid } from '../helpers/infinite-grid'
import { disposeObject3D } from '../utils/dispose'

const FALLBACK_BG = '#0c1420'

export interface EnvironmentServiceOptions {
  runtime: ThreeRuntime
  envGroup: THREE.Group
  /** Host/assets：解析非内建 enclosure id（如 openBoxDoor） */
  resolveEnclosure?: (
    kind: string,
    size: { width: number; height: number; depth: number }
  ) => Promise<THREE.Object3D | null | undefined> | THREE.Object3D | null | undefined
}

/**
 * Document.environment → Three 场景呈现（背景 / IBL / 灯 / 阴影 / grid / enclosure）。
 */
export class EnvironmentService {
  private runtime: ThreeRuntime
  private envGroup: THREE.Group
  private resolveEnclosure?: EnvironmentServiceOptions['resolveEnclosure']
  private applyToken = 0
  private bgTexture: THREE.Texture | null = null
  private pmrem: THREE.PMREMGenerator
  /** RoomEnvironment 预烘焙缓存；跨 apply 复用 */
  private roomEnvMap: THREE.Texture | null = null
  /** 当前挂在 scene.environment 上的 RT（equirect 派生时需单独释放） */
  private activeEnvMap: THREE.Texture | null = null
  private activeEnvFromRoom = false

  constructor(options: EnvironmentServiceOptions) {
    this.runtime = options.runtime
    this.envGroup = options.envGroup
    this.resolveEnclosure = options.resolveEnclosure
    this.pmrem = new THREE.PMREMGenerator(this.runtime.renderer)
  }

  async apply(env: EnvironmentJSON, bounds: BoundsJSON): Promise<void> {
    const token = ++this.applyToken
    this.clearEnvGroup()
    this.runtime.setShadowMap({
      enabled: env.shadows.enabled,
      type: env.shadows.type ?? 'pcfsoft'
    })

    await this.applyBackgroundAndIbl(env, token)
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
      this.envGroup.add(createInfiniteGrid())
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
    this.runtime.markShadowNeedsUpdate()
  }

  dispose(): void {
    this.applyToken++
    this.clearEnvGroup()
    this.disposeBgTexture()
    this.clearSceneEnvironment()
    if (this.roomEnvMap) {
      this.roomEnvMap.dispose()
      this.roomEnvMap = null
    }
    this.pmrem.dispose()
  }

  private async applyBackgroundAndIbl(env: EnvironmentJSON, token: number): Promise<void> {
    const bg = env.background
    if (bg.type === 'color') {
      this.disposeBgTexture()
      this.runtime.scene.background = new THREE.Color(bg.value)
      this.setRoomEnvironment()
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
      this.setEnvironmentFromEquirect(texture)
    } catch {
      if (token !== this.applyToken) return
      this.disposeBgTexture()
      this.runtime.scene.background = new THREE.Color(FALLBACK_BG)
      this.setRoomEnvironment()
    }
  }

  /** 默认 IBL：RoomEnvironment 烘焙一次后缓存 */
  private setRoomEnvironment(): void {
    if (!this.roomEnvMap) {
      this.roomEnvMap = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    }
    this.clearSceneEnvironment({ keepRoomCache: true })
    this.runtime.scene.environment = this.roomEnvMap
    this.activeEnvMap = this.roomEnvMap
    this.activeEnvFromRoom = true
  }

  /** equirect/HDR 同时作 background 与 environment */
  private setEnvironmentFromEquirect(source: THREE.Texture): void {
    const envMap = this.pmrem.fromEquirectangular(source).texture
    this.clearSceneEnvironment({ keepRoomCache: true })
    this.runtime.scene.environment = envMap
    this.activeEnvMap = envMap
    this.activeEnvFromRoom = false
  }

  private clearSceneEnvironment(options?: { keepRoomCache?: boolean }): void {
    this.runtime.scene.environment = null
    if (this.activeEnvMap && !this.activeEnvFromRoom) {
      this.activeEnvMap.dispose()
    }
    this.activeEnvMap = null
    this.activeEnvFromRoom = false
    if (!options?.keepRoomCache && this.roomEnvMap) {
      this.roomEnvMap.dispose()
      this.roomEnvMap = null
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
      disposeObject3D(child)
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
