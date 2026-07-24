import * as THREE from 'three'
import type { CoreContext } from '@3d-editor/editor'
import type { FactoryPresetOptions } from './types'

export function configureRenderer(
  ctx: CoreContext,
  options?: FactoryPresetOptions['renderer']
) {
  const renderer = ctx.renderer.renderer
  
  renderer.setClearColor(new THREE.Color('#000000'), 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = options?.shadowMapType ?? THREE.PCFSoftShadowMap
  renderer.toneMapping = options?.toneMapping ?? THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = options?.toneMappingExposure ?? 1.15
  ;(renderer as any).outputEncoding = THREE.sRGBEncoding
  ;(renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace ?? THREE.SRGBColorSpace
  
  // 使场景背景透明，由 HTML 背景渐变控制
  ctx.scene.background = null
  ctx.renderer.domElement.style.backgroundColor = 'transparent'
}

