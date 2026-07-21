import * as THREE from 'three'
import type { LightSchema } from '../types'

export const createAmbientLight = (color: number | string = 0xffffff, intensity = 0.5): THREE.AmbientLight =>
  new THREE.AmbientLight(color, intensity)

export const createDirectionalLight = (
  color: number | string = 0xffffff,
  intensity = 1,
  position: [number, number, number] = [5, 5, 5]
): THREE.DirectionalLight => {
  const light = new THREE.DirectionalLight(color, intensity)
  light.position.set(...position)
  light.castShadow = true
  return light
}

export const serializeLight = (light: THREE.Light): LightSchema => ({
  id: light.uuid,
  name: light.name,
  type: light.type.toLowerCase() as LightSchema['type'],
  color: `#${light.color.getHexString()}`,
  intensity: light.intensity,
  position: (light as THREE.Object3D).position?.toArray() as [number, number, number],
  castShadow: (light as THREE.DirectionalLight).castShadow ?? false
})
