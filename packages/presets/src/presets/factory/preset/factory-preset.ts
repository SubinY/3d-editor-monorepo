import * as THREE from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import type { CoreContext, ScenePreset } from '@3d-editor/editor'
import type { FactoryPresetOptions, FactoryPresetState } from './types'
import { configureRenderer } from './renderer'
import { applyGradientBackground } from './background'
import { configureCamera } from './camera'
import { setupLights } from './lighting'
import { setupFloor } from './floor'

async function loadEquirectTexture(url: string): Promise<THREE.DataTexture | THREE.Texture> {
  const lower = url.toLowerCase()
  if (lower.endsWith('.exr')) {
    const loader = new EXRLoader()
    return loader.loadAsync(url)
  }
  if (lower.endsWith('.hdr')) {
    const loader = new RGBELoader()
    return loader.loadAsync(url)
  }
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader()
    loader.load(url, resolve, undefined, reject)
  })
}

export const factoryPreset: ScenePreset<FactoryPresetOptions, FactoryPresetState> = {
  id: 'factory',
  label: 'Factory Editor Preset',
  
  async setup(ctx: CoreContext, options?: FactoryPresetOptions): Promise<FactoryPresetState> {
    // 1. 配置渲染器
    configureRenderer(ctx, options?.renderer)
    
    // 2. 背景：颜色 / 图片 / 全景图 互斥
    const container = ctx.renderer.domElement.parentElement
    const bg = options?.background
    const bgType = bg?.type ?? 'color'
    let backgroundTexture: THREE.Texture | undefined
    let envMap: THREE.Texture | undefined

    if (bgType === 'color' && bg?.color) {
      ctx.scene.background = new THREE.Color(bg.color)
    } else if (bgType === 'image' && bg?.imageUrl) {
      const tex = await new THREE.TextureLoader().loadAsync(bg.imageUrl)
      tex.mapping = THREE.EquirectangularReflectionMapping
      ctx.scene.background = tex
      backgroundTexture = tex
      ctx.scene.environment = null
    } else if (bgType === 'panorama' && bg?.panoramaUrl) {
      const texture = await loadEquirectTexture(bg.panoramaUrl)
      texture.mapping = THREE.EquirectangularReflectionMapping
      ctx.scene.background = texture
      backgroundTexture = texture

      const renderer = ctx.renderer.renderer
      const pmrem = new THREE.PMREMGenerator(renderer)
      pmrem.compileEquirectangularShader()
      const cubeRt = pmrem.fromEquirectangular(texture)
      envMap = cubeRt.texture
      ctx.scene.environment = envMap
      pmrem.dispose()
    } else if (container) {
      applyGradientBackground(container, options?.background)
    }
    
    // 3. 配置相机
    configureCamera(ctx, options?.camera)
    
    // 4. 设置地板
    const floorState = setupFloor(ctx, options?.floor)
    
    // 5. 设置灯光（依赖 floorSize）
    const lightingState = setupLights(ctx, floorState.floorSize, options?.lighting)
    
    // 6. Environment（HDR IBL）- 仅当背景为颜色时使用预设 env，图片/全景图已在上方处理
    const envOpts = options?.environment
    if (envOpts?.url && bgType === 'color') {
      const renderer = ctx.renderer.renderer
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
    
    return {
      container: container!,
      ...floorState,
      ...lightingState,
      envMap,
      backgroundTexture
    }
  },
  
  dispose(ctx: CoreContext, state?: FactoryPresetState) {
    if (!state) return
    
    // 清理地板
    if (state.floorGroup) {
      ctx.scene.remove(state.floorGroup)
    }
    
    // 清理灯光
    state.lights.forEach(light => ctx.scene.remove(light))
    
    // 清理光源目标
    if (state.lightTarget) {
      ctx.scene.remove(state.lightTarget)
    }
    
    // 恢复背景
    if (state.container) {
      state.container.style.backgroundImage = ''
    }
    
    if (state.envMap) {
      ctx.scene.environment = null
      state.envMap.dispose()
    }
    if (state.backgroundTexture) {
      ctx.scene.background = null
      state.backgroundTexture.dispose()
    }
  }
}

