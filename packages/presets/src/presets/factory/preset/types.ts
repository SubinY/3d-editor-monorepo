import type * as THREE from 'three'

export interface FactoryPresetOptions {
  background?: {
    type?: 'color' | 'image' | 'panorama'
    color?: string
    imageUrl?: string
    panoramaUrl?: string
    gradient?: string[]
    enableNoise?: boolean
  }
  floor?: {
    width?: number
    depth?: number
    color?: number | string
    showFrame?: boolean
    border?: {
      innerColor?: number | string
      outerColor?: number | string
      innerWidth?: number
      outerWidth?: number
      innerOpacity?: number
      outerOpacity?: number
    }
  }
  lighting?: {
    ambientColor?: number | string
    ambientIntensity?: number
    mainColor?: number | string
    mainIntensity?: number
    mainPosition?: [number, number, number]
    shadowMapSize?: number
  }
  camera?: {
    fov?: number
    position?: [number, number, number]
    target?: [number, number, number]
  }
  renderer?: {
    toneMapping?: THREE.ToneMapping
    toneMappingExposure?: number
    shadowMapType?: THREE.ShadowMapType
  }
  environment?: {
    url: string
    intensity?: number
  }
}

export interface FactoryPresetState {
  container: HTMLElement
  envMap?: THREE.Texture
  backgroundTexture?: THREE.Texture
  floor?: THREE.Object3D
  floorGroup?: THREE.Group
  floorSize: { width: number; depth: number }
  lights: THREE.Light[]
  lightTarget?: THREE.Object3D
  resizeFloor: (options?: { deltaX?: number; deltaZ?: number; width?: number; depth?: number }) => Promise<{
    width: number
    depth: number
  }>
  clampToFloor: (obj: THREE.Object3D) => void
  updateLightShadowBounds: () => void
}

