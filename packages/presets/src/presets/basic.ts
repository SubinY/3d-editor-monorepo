import * as THREE from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { createAmbientLight, createDirectionalLight, type ScenePreset } from '@3d-editor/editor'

export interface BasicPresetOptions {
  background?: string
  ambientIntensity?: number
  dirIntensity?: number
  dirPosition?: [number, number, number]
  environment?: {
    url: string
    intensity?: number
  }
  grid?: {
    size?: number
    divisions?: number
    colorCenterLine?: number | string
    colorGrid?: number | string
  }
}

export interface BasicPresetState {
  grid?: THREE.GridHelper
  lights: THREE.Light[]
  envMap?: THREE.Texture
}

export const basicPreset: ScenePreset<BasicPresetOptions, BasicPresetState> = {
  id: 'basic',
  async setup(ctx, options) {
    const renderer = ctx.renderer.renderer
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.outputEncoding = THREE.sRGBEncoding

    ctx.scene.background = new THREE.Color(options?.background ?? '#e8ecf0')

    const ambient = createAmbientLight('#ffffff', options?.ambientIntensity ?? 0.9)
    const dir = createDirectionalLight(
      '#ffffff',
      options?.dirIntensity ?? 1.5,
      options?.dirPosition ?? [8, 15, 10]
    )
    ;[ambient, dir].forEach(light => {
      light.userData.nonSelectable = true
      light.raycast = () => {}
    })
    ctx.scene.add(ambient, dir)

    let envMap: THREE.Texture | undefined
    const envOpts = options?.environment
    if (envOpts?.url) {
      const exrLoader = new EXRLoader()
      const pmrem = new THREE.PMREMGenerator(renderer)
      pmrem.compileEquirectangularShader()
      const texture = await exrLoader.loadAsync(envOpts.url)
      const cubeRt = pmrem.fromEquirectangular(texture)
      envMap = cubeRt.texture
      texture.dispose()
      pmrem.dispose()
      ctx.scene.environment = envMap
      const intensity = envOpts.intensity ?? 1.0
      if (intensity !== 1.0) {
        ;(ctx.scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = intensity
      }
    }

    let grid: THREE.GridHelper | undefined
    if (options?.grid !== null) {
      grid = new THREE.GridHelper(
        options?.grid?.size ?? 400,
        options?.grid?.divisions ?? 80,
        options?.grid?.colorCenterLine ?? 0x2b2b2b,
        options?.grid?.colorGrid ?? 0x151515
      )
      grid.userData.nonSelectable = true
      grid.raycast = () => {}
      ctx.scene.add(grid)
    }

    return {
      grid,
      lights: [ambient, dir],
      envMap
    }
  },
  dispose(ctx, state) {
    state?.grid && ctx.scene.remove(state.grid)
    state?.lights?.forEach(light => ctx.scene.remove(light))
    if (state?.envMap) {
      ctx.scene.environment = null
      state.envMap.dispose()
    }
  }
}
